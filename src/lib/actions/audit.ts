"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/actions/auth";

export interface AuditLogEntry {
  id: string;
  tree_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  actor: {
    clerk_id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  subject_profile: {
    clerk_id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  subject_member: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
  related_members: Array<{
    id: string;
    name: string;
    avatar_url: string | null;
    role: "from" | "to";
  }>;
}

export interface TreeSnapshot {
  id: string;
  tree_id: string;
  created_by: string;
  snapshot_data: {
    members: Record<string, unknown>[];
    relationships: Record<string, unknown>[];
  };
  description: string | null;
  created_at: string;
}

export interface AuditLogOptions {
  page?: number;
  pageSize?: number;
  entityType?: string;
  action?: string;
}

async function checkTreeAccess(
  supabase: ReturnType<typeof createAdminClient>,
  treeId: string,
  userId: string
) {
  const { data } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!data) throw new Error("No access to this tree");
  return data;
}

export async function getAuditLog(
  treeId: string,
  options: AuditLogOptions = {}
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  await checkTreeAccess(supabase, treeId, userId);

  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .eq("tree_id", treeId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (options.entityType) {
    query = query.eq("entity_type", options.entityType);
  }
  if (options.action) {
    query = query.eq("action", options.action);
  }

  const { data, error, count } = await query;

  if (error) throw new Error(`Failed to fetch audit log: ${error.message}`);

  const rows = (data ?? []) as Array<{
    id: string;
    tree_id: string;
    user_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    old_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
    created_at: string;
  }>;

  if (rows.length === 0) {
    return { entries: [], total: count ?? 0 };
  }

  const profileIds = new Set<string>();
  const memberIds = new Set<string>();

  for (const row of rows) {
    if (row.user_id) profileIds.add(row.user_id);

    const payload = (row.new_data ?? row.old_data) as Record<string, unknown> | null;
    const affectedUserId = typeof payload?.user_id === "string" ? payload.user_id : null;
    if (affectedUserId) profileIds.add(affectedUserId);

    const fromMemberId = typeof payload?.from_member_id === "string" ? payload.from_member_id : null;
    const toMemberId = typeof payload?.to_member_id === "string" ? payload.to_member_id : null;
    if (fromMemberId) memberIds.add(fromMemberId);
    if (toMemberId) memberIds.add(toMemberId);

    if (row.entity_type === "tree_member" && row.entity_id) {
      memberIds.add(row.entity_id);
    }
  }

  const [profilesResult, membersResult] = await Promise.all([
    profileIds.size > 0
      ? supabase
        .from("profiles")
        .select("clerk_id, display_name, avatar_url")
        .in("clerk_id", Array.from(profileIds))
      : Promise.resolve({ data: [], error: null }),
    memberIds.size > 0
      ? supabase
        .from("tree_members")
        .select("id, first_name, last_name, avatar_url")
        .in("id", Array.from(memberIds))
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profileMap = new Map(
    ((profilesResult.data ?? []) as Array<{ clerk_id: string; display_name: string; avatar_url: string | null }>).map((profile) => [profile.clerk_id, profile])
  );

  const memberMap = new Map(
    ((membersResult.data ?? []) as Array<{ id: string; first_name: string; last_name: string | null; avatar_url: string | null }>).map((member) => [
      member.id,
      {
        id: member.id,
        name: `${member.first_name}${member.last_name ? ` ${member.last_name}` : ""}`,
        avatar_url: member.avatar_url,
      },
    ])
  );

  const enriched: AuditLogEntry[] = rows.map((row) => {
    const payload = (row.new_data ?? row.old_data) as Record<string, unknown> | null;
    const affectedUserId = typeof payload?.user_id === "string" ? payload.user_id : null;
    const fromMemberId = typeof payload?.from_member_id === "string" ? payload.from_member_id : null;
    const toMemberId = typeof payload?.to_member_id === "string" ? payload.to_member_id : null;

    const relatedMembers: Array<{ id: string; name: string; avatar_url: string | null; role: "from" | "to" }> = [];
    if (fromMemberId) {
      const member = memberMap.get(fromMemberId);
      if (member) relatedMembers.push({ ...member, role: "from" });
    }
    if (toMemberId) {
      const member = memberMap.get(toMemberId);
      if (member) relatedMembers.push({ ...member, role: "to" });
    }

    const subjectMember =
      row.entity_type === "tree_member" && row.entity_id
        ? memberMap.get(row.entity_id) ?? null
        : null;

    return {
      ...row,
      actor: row.user_id ? profileMap.get(row.user_id) ?? null : null,
      subject_profile: affectedUserId ? profileMap.get(affectedUserId) ?? null : null,
      subject_member: subjectMember,
      related_members: relatedMembers,
    };
  });

  return { entries: enriched, total: count ?? 0 };
}

export async function createSnapshot(
  treeId: string,
  description: string
): Promise<TreeSnapshot> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  const membership = await checkTreeAccess(supabase, treeId, userId);
  if (membership.role === "viewer") {
    throw new Error("Viewers cannot create snapshots");
  }

  // Fetch current tree state
  const [membersResult, relationshipsResult] = await Promise.all([
    supabase.from("tree_members").select("*").eq("tree_id", treeId),
    supabase.from("relationships").select("*").eq("tree_id", treeId),
  ]);

  if (membersResult.error)
    throw new Error(`Failed to fetch members: ${membersResult.error.message}`);
  if (relationshipsResult.error)
    throw new Error(
      `Failed to fetch relationships: ${relationshipsResult.error.message}`
    );

  const snapshotData = {
    members: membersResult.data ?? [],
    relationships: relationshipsResult.data ?? [],
  };

  const { data, error } = await supabase
    .from("tree_snapshots")
    .insert({
      tree_id: treeId,
      created_by: userId,
      snapshot_data: snapshotData,
      description: description.trim() || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create snapshot: ${error.message}`);

  revalidatePath(`/tree/${treeId}/history`);
  return data as TreeSnapshot;
}

export async function getSnapshots(treeId: string): Promise<TreeSnapshot[]> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  await checkTreeAccess(supabase, treeId, userId);

  const { data, error } = await supabase
    .from("tree_snapshots")
    .select("*")
    .eq("tree_id", treeId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch snapshots: ${error.message}`);
  return (data ?? []) as TreeSnapshot[];
}

export async function rollbackToSnapshot(
  treeId: string,
  snapshotId: string
): Promise<void> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  const membership = await checkTreeAccess(supabase, treeId, userId);
  if (membership.role !== "owner") {
    throw new Error("Only the owner can rollback to a snapshot");
  }

  // Fetch the snapshot
  const { data: snapshot, error: snapshotError } = await supabase
    .from("tree_snapshots")
    .select("*")
    .eq("id", snapshotId)
    .eq("tree_id", treeId)
    .single();

  if (snapshotError || !snapshot) {
    throw new Error("Snapshot not found");
  }

  const snapshotData = snapshot.snapshot_data as TreeSnapshot["snapshot_data"];

  // Set user context for audit triggers
  await supabase.rpc("set_request_user_id", { user_id: userId });

  // Delete current relationships first (foreign key constraints)
  const { error: delRelError } = await supabase
    .from("relationships")
    .delete()
    .eq("tree_id", treeId);

  if (delRelError)
    throw new Error(
      `Failed to clear relationships: ${delRelError.message}`
    );

  // Delete current members
  const { error: delMemError } = await supabase
    .from("tree_members")
    .delete()
    .eq("tree_id", treeId);

  if (delMemError)
    throw new Error(`Failed to clear members: ${delMemError.message}`);

  // Re-insert members from snapshot
  if (snapshotData.members && snapshotData.members.length > 0) {
    const { error: insMemError } = await supabase
      .from("tree_members")
      .insert(snapshotData.members);

    if (insMemError)
      throw new Error(
        `Failed to restore members: ${insMemError.message}`
      );
  }

  // Re-insert relationships from snapshot
  if (snapshotData.relationships && snapshotData.relationships.length > 0) {
    const { error: insRelError } = await supabase
      .from("relationships")
      .insert(snapshotData.relationships);

    if (insRelError)
      throw new Error(
        `Failed to restore relationships: ${insRelError.message}`
      );
  }

  revalidatePath(`/tree/${treeId}`);
  revalidatePath(`/tree/${treeId}/history`);
}
