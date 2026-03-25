"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/actions/auth";
import { createMemberSchema, updateMemberSchema } from "@/lib/validators/member";
import type { CreateMemberInput, UpdateMemberInput } from "@/lib/validators/member";
import type { TreeMember } from "@/types";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { assertUUID } from "@/lib/validate";

async function checkTreeAccess(supabase: ReturnType<typeof createAdminClient>, treeId: string, userId: string) {
  const { data } = await supabase
    .from("tree_memberships")
    .select("role, linked_node_id")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!data) throw new Error("No access to this tree");
  return data;
}

export async function createMember(input: CreateMemberInput): Promise<TreeMember> {
  const userId = await getAuthUser();
  rateLimit(userId, 'createMember', 30, 60_000);
  const validated = createMemberSchema.parse(input);
  const supabase = createAdminClient();

  const membership = await checkTreeAccess(supabase, validated.tree_id, userId);
  if (membership.role === "viewer") throw new Error("Viewers cannot add members");

  // Editors with a linked node can only add members (they'll be scoped at relationship creation)
  // Standalone member creation is allowed; branch scope is enforced in createRelationship

  // Set the user context for audit triggers
  await supabase.rpc("set_request_user_id", { user_id: userId });

  const orNull = (v: string | undefined | null) => v && v.trim() !== "" ? v : null;

  const { data, error } = await supabase
    .from("tree_members")
    .insert({
      tree_id: validated.tree_id,
      first_name: validated.first_name,
      last_name: orNull(validated.last_name),
      maiden_name: orNull(validated.maiden_name),
      gender: orNull(validated.gender),
      date_of_birth: orNull(validated.date_of_birth),
      date_of_death: orNull(validated.date_of_death),
      birth_year: validated.birth_year ?? null,
      birth_month: validated.birth_month ?? null,
      birth_day: validated.birth_day ?? null,
      death_year: validated.death_year ?? null,
      death_month: validated.death_month ?? null,
      death_day: validated.death_day ?? null,
      birth_place: validated.birth_place ? sanitizeText(validated.birth_place) : null,
      death_place: validated.death_place ? sanitizeText(validated.death_place) : null,
      bio: validated.bio ? sanitizeText(validated.bio) : null,
      is_deceased: validated.is_deceased ?? false,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create member: ${error.message}`);
  return data as TreeMember;
}

export async function updateMember(memberId: string, treeId: string, input: UpdateMemberInput): Promise<TreeMember> {
  const userId = await getAuthUser();
  assertUUID(memberId, 'memberId');
  assertUUID(treeId, 'treeId');
  const validated = updateMemberSchema.parse(input);
  const supabase = createAdminClient();

  const membership = await checkTreeAccess(supabase, treeId, userId);
  if (membership.role === "viewer") throw new Error("Viewers cannot edit members");

  // Editors can only edit descendants of their linked node
  if (membership.role === "editor" && membership.linked_node_id) {
    const { data: canEdit } = await supabase.rpc("is_descendant_of", {
      p_tree_id: treeId,
      p_node_id: memberId,
      p_ancestor_id: membership.linked_node_id,
    });
    if (!canEdit) throw new Error("You can only edit members in your branch");
  }

  await supabase.rpc("set_request_user_id", { user_id: userId });

  const sanitized = Object.fromEntries(
    Object.entries(validated).map(([k, v]) => {
      if (typeof v === "string") {
        const trimmed = v.trim();
        if (trimmed === "") return [k, null];
        if (k === "bio" || k === "birth_place" || k === "death_place") {
          return [k, sanitizeText(trimmed)];
        }
        return [k, trimmed];
      }
      return [k, v];
    })
  );

  const { data, error } = await supabase
    .from("tree_members")
    .update(sanitized)
    .eq("id", memberId)
    .eq("tree_id", treeId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update member: ${error.message}`);
  return data as TreeMember;
}

export async function deleteMember(memberId: string, treeId: string) {
  const userId = await getAuthUser();
  assertUUID(memberId, 'memberId');
  assertUUID(treeId, 'treeId');
  const supabase = createAdminClient();

  const membership = await checkTreeAccess(supabase, treeId, userId);
  if (membership.role === "viewer") throw new Error("Viewers cannot delete members");

  if (membership.role === "editor" && membership.linked_node_id) {
    const { data: canEdit } = await supabase.rpc("is_descendant_of", {
      p_tree_id: treeId,
      p_node_id: memberId,
      p_ancestor_id: membership.linked_node_id,
    });
    if (!canEdit) throw new Error("You can only delete members in your branch");
  }

  await supabase.rpc("set_request_user_id", { user_id: userId });

  const { error } = await supabase
    .from("tree_members")
    .delete()
    .eq("id", memberId)
    .eq("tree_id", treeId);

  if (error) throw new Error(`Failed to delete member: ${error.message}`);
}

export async function getMembersByTreeId(treeId: string): Promise<TreeMember[]> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  await checkTreeAccess(supabase, treeId, userId);

  const { data, error } = await supabase
    .from("tree_members")
    .select("*")
    .eq("tree_id", treeId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch members: ${error.message}`);
  return (data ?? []) as TreeMember[];
}

export async function saveMemberPositions(
  treeId: string,
  positions: Array<{ id: string; position_x: number; position_y: number }>
): Promise<void> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  const membership = await checkTreeAccess(supabase, treeId, userId);
  if (membership.role === "viewer") return;

  // Scoped editors can only reposition nodes within their branch
  if (membership.role === "editor" && membership.linked_node_id) {
    for (const pos of positions) {
      const { data: inScope } = await supabase.rpc("is_descendant_of", {
        p_tree_id: treeId,
        p_node_id: pos.id,
        p_ancestor_id: membership.linked_node_id,
      });
      if (!inScope) throw new Error("You can only reposition members in your branch");
    }
  }

  // Batch update positions
  for (const pos of positions) {
    await supabase
      .from("tree_members")
      .update({ position_x: pos.position_x, position_y: pos.position_y })
      .eq("id", pos.id)
      .eq("tree_id", treeId);
  }
}

export interface MemberWithStats extends TreeMember {
  relationship_count: number;
  photo_count: number;
  document_count: number;
  completeness: "complete" | "partial" | "empty";
}

export async function getMembersWithStats(treeId: string): Promise<MemberWithStats[]> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  await checkTreeAccess(supabase, treeId, userId);

  const [membersResult, relsResult, photosResult, docsResult] = await Promise.all([
    supabase.from("tree_members").select("*").eq("tree_id", treeId).order("first_name"),
    supabase.from("relationships").select("from_member_id, to_member_id").eq("tree_id", treeId),
    supabase.from("media").select("member_id").eq("tree_id", treeId),
    supabase.from("documents").select("member_id").eq("tree_id", treeId),
  ]);

  if (membersResult.error) throw new Error(`Failed to fetch members: ${membersResult.error.message}`);

  const relCounts = new Map<string, number>();
  for (const rel of relsResult.data ?? []) {
    relCounts.set(rel.from_member_id, (relCounts.get(rel.from_member_id) ?? 0) + 1);
    relCounts.set(rel.to_member_id, (relCounts.get(rel.to_member_id) ?? 0) + 1);
  }

  const photoCounts = new Map<string, number>();
  for (const p of photosResult.data ?? []) {
    if (p.member_id) photoCounts.set(p.member_id, (photoCounts.get(p.member_id) ?? 0) + 1);
  }

  const docCounts = new Map<string, number>();
  for (const d of docsResult.data ?? []) {
    if (d.member_id) docCounts.set(d.member_id, (docCounts.get(d.member_id) ?? 0) + 1);
  }

  return (membersResult.data as TreeMember[]).map((m) => {
    const relCount = relCounts.get(m.id) ?? 0;
    const hasBirthValue = Boolean(m.date_of_birth || m.birth_year);
    const filledFields = [m.first_name, m.last_name, hasBirthValue ? "1" : ""].filter(Boolean).length;
    const completeness: MemberWithStats["completeness"] =
      filledFields === 3 && relCount > 0 ? "complete" :
        filledFields > 0 || relCount > 0 ? "partial" : "empty";
    return {
      ...m,
      relationship_count: relCount,
      photo_count: photoCounts.get(m.id) ?? 0,
      document_count: docCounts.get(m.id) ?? 0,
      completeness,
    };
  });
}

export async function getMemberById(memberId: string, treeId: string): Promise<TreeMember | null> {
  const userId = await getAuthUser();
  assertUUID(memberId, 'memberId');
  assertUUID(treeId, 'treeId');
  const supabase = createAdminClient();

  await checkTreeAccess(supabase, treeId, userId);

  const { data, error } = await supabase
    .from("tree_members")
    .select("*")
    .eq("id", memberId)
    .eq("tree_id", treeId)
    .single();

  if (error) return null;
  return data as TreeMember;
}
