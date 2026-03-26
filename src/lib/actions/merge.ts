"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/actions/auth";
import { assertUUID } from "@/lib/validate";
import { sanitizeText } from "@/lib/sanitize";
import type { TreeSummary } from "@/types";

export type ConflictResolution = "merge" | "copy" | "skip";

export interface MergeConflict {
  sourceMemberId: string;
  sourceDisplayName: string;
  targetMemberId: string;
  targetDisplayName: string;
  dateOfBirth: string | null;
}

export interface MemberMapping {
  sourceMemberId: string;
  resolution: ConflictResolution;
  targetMemberId?: string;
}

async function assertOwner(
  supabase: ReturnType<typeof createAdminClient>,
  treeId: string,
  userId: string
) {
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership || membership.role !== "owner") {
    throw new Error("Only the owner can perform this action");
  }
}

export async function getOwnedTreesForMerge(excludeTreeId: string): Promise<TreeSummary[]> {
  const userId = await getAuthUser();
  assertUUID(excludeTreeId, "excludeTreeId");
  const supabase = createAdminClient();

  const { data: memberships } = await supabase
    .from("tree_memberships")
    .select("tree_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .neq("tree_id", excludeTreeId);

  if (!memberships || memberships.length === 0) return [];

  const treeIds = memberships.map((m) => m.tree_id);

  const [{ data: trees }, { data: counts }] = await Promise.all([
    supabase.from("family_trees").select("id, name, description, is_public, updated_at").in("id", treeIds),
    supabase.from("tree_members").select("tree_id").in("tree_id", treeIds),
  ]);

  const countMap = new Map<string, number>();
  for (const c of counts ?? []) {
    countMap.set(c.tree_id, (countMap.get(c.tree_id) ?? 0) + 1);
  }

  return (trees ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    is_public: t.is_public,
    member_count: countMap.get(t.id) ?? 0,
    role: "owner" as const,
    updated_at: t.updated_at,
  }));
}

export async function previewMerge(
  sourceTreeId: string,
  targetTreeId: string
): Promise<MergeConflict[]> {
  const userId = await getAuthUser();
  assertUUID(sourceTreeId, "sourceTreeId");
  assertUUID(targetTreeId, "targetTreeId");
  const supabase = createAdminClient();

  await Promise.all([
    assertOwner(supabase, targetTreeId, userId),
    assertOwner(supabase, sourceTreeId, userId),
  ]);

  const [{ data: sourceMembers }, { data: targetMembers }] = await Promise.all([
    supabase.from("tree_members").select("id, first_name, last_name, date_of_birth").eq("tree_id", sourceTreeId),
    supabase.from("tree_members").select("id, first_name, last_name, date_of_birth").eq("tree_id", targetTreeId),
  ]);

  const conflicts: MergeConflict[] = [];

  for (const src of sourceMembers ?? []) {
    const match = (targetMembers ?? []).find(
      (t) =>
        src.date_of_birth !== null &&
        t.date_of_birth !== null &&
        t.date_of_birth === src.date_of_birth &&
        t.first_name?.toLowerCase() === src.first_name?.toLowerCase() &&
        t.last_name?.toLowerCase() === src.last_name?.toLowerCase()
    );
    if (match) {
      conflicts.push({
        sourceMemberId: src.id,
        sourceDisplayName: `${src.first_name ?? ""} ${src.last_name ?? ""}`.trim(),
        targetMemberId: match.id,
        targetDisplayName: `${match.first_name ?? ""} ${match.last_name ?? ""}`.trim(),
        dateOfBirth: src.date_of_birth,
      });
    }
  }

  return conflicts;
}

export async function mergeTree(
  sourceTreeId: string,
  targetTreeId: string,
  mappings: MemberMapping[]
): Promise<void> {
  const userId = await getAuthUser();
  assertUUID(sourceTreeId, "sourceTreeId");
  assertUUID(targetTreeId, "targetTreeId");

  if (sourceTreeId === targetTreeId) throw new Error("Cannot merge a tree into itself");

  const supabase = createAdminClient();

  await Promise.all([
    assertOwner(supabase, targetTreeId, userId),
    assertOwner(supabase, sourceTreeId, userId),
  ]);

  const { data: sourceMembers, error: membersError } = await supabase
    .from("tree_members")
    .select("*")
    .eq("tree_id", sourceTreeId);

  if (membersError) throw new Error(`Failed to fetch source members: ${membersError.message}`);

  const mappingBySourceId = new Map(mappings.map((m) => [m.sourceMemberId, m]));
  const idMap = new Map<string, string>();
  const skippedIds = new Set<string>();

  // Register merge mappings (source → existing target member)
  for (const m of mappings) {
    if (m.resolution === "merge" && m.targetMemberId) {
      idMap.set(m.sourceMemberId, m.targetMemberId);
    } else if (m.resolution === "skip") {
      skippedIds.add(m.sourceMemberId);
    }
  }

  // Members to copy as new (not merged, not skipped)
  const membersToCopy = (sourceMembers ?? []).filter((m) => {
    const mapping = mappingBySourceId.get(m.id);
    return !mapping || mapping.resolution === "copy";
  });

  if (membersToCopy.length > 0) {
    const newMembers = membersToCopy.map((m) => ({
      tree_id: targetTreeId,
      first_name: sanitizeText(m.first_name ?? ""),
      last_name: m.last_name ? sanitizeText(m.last_name) : null,
      maiden_name: m.maiden_name ? sanitizeText(m.maiden_name) : null,
      gender: m.gender,
      date_of_birth: m.date_of_birth,
      date_of_death: m.date_of_death,
      birth_place: m.birth_place ? sanitizeText(m.birth_place) : null,
      death_place: m.death_place ? sanitizeText(m.death_place) : null,
      bio: m.bio ? sanitizeText(m.bio) : null,
      is_deceased: m.is_deceased,
      created_by: userId,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("tree_members")
      .insert(newMembers)
      .select("id");

    if (insertError) throw new Error(`Failed to copy members: ${insertError.message}`);

    (inserted ?? []).forEach((row, i) => {
      idMap.set(membersToCopy[i].id, row.id);
    });
  }

  // Remap and insert relationships
  const { data: sourceRels, error: relsError } = await supabase
    .from("relationships")
    .select("*")
    .eq("tree_id", sourceTreeId);

  if (relsError) throw new Error(`Failed to fetch source relationships: ${relsError.message}`);

  const relsToInsert = (sourceRels ?? [])
    .filter((r) => !skippedIds.has(r.from_member_id) && !skippedIds.has(r.to_member_id))
    .filter((r) => idMap.has(r.from_member_id) && idMap.has(r.to_member_id))
    .map((r) => ({
      tree_id: targetTreeId,
      from_member_id: idMap.get(r.from_member_id)!,
      to_member_id: idMap.get(r.to_member_id)!,
      relationship_type: r.relationship_type,
      start_date: r.start_date ?? null,
      end_date: r.end_date ?? null,
    }))
    .filter((r) => r.from_member_id !== r.to_member_id);

  if (relsToInsert.length > 0) {
    const { error: relInsertError } = await supabase
      .from("relationships")
      .upsert(relsToInsert, {
        onConflict: "tree_id,from_member_id,to_member_id,relationship_type",
        ignoreDuplicates: true,
      });

    if (relInsertError) throw new Error(`Failed to copy relationships: ${relInsertError.message}`);
  }

  // Copy non-profile-photo media references
  const { data: sourceMedia } = await supabase
    .from("media")
    .select("*")
    .eq("tree_id", sourceTreeId)
    .eq("is_profile_photo", false);

  const mediaToInsert = (sourceMedia ?? [])
    .filter((m) => !m.member_id || (!skippedIds.has(m.member_id) && idMap.has(m.member_id)))
    .map((m) => ({
      tree_id: targetTreeId,
      uploaded_by: userId,
      storage_path: m.storage_path,
      file_name: m.file_name,
      file_size: m.file_size,
      mime_type: m.mime_type,
      member_id: m.member_id ? (idMap.get(m.member_id) ?? null) : null,
      is_profile_photo: false,
      caption: m.caption ? sanitizeText(m.caption) : null,
    }));

  if (mediaToInsert.length > 0) {
    await supabase.from("media").insert(mediaToInsert);
  }

  // Audit log
  await supabase.from("audit_log").insert({
    tree_id: targetTreeId,
    user_id: userId,
    action: "merge_tree",
    entity_type: "family_trees",
    entity_id: sourceTreeId,
    new_data: {
      source_tree_id: sourceTreeId,
      members_copied: membersToCopy.length,
      members_merged: mappings.filter((m) => m.resolution === "merge").length,
      members_skipped: skippedIds.size,
      relationships_copied: relsToInsert.length,
    },
  });

  // Delete source tree
  const { error: deleteError } = await supabase
    .from("family_trees")
    .delete()
    .eq("id", sourceTreeId)
    .eq("owner_id", userId);

  if (deleteError) throw new Error(`Failed to delete source tree: ${deleteError.message}`);

  revalidatePath(`/tree/${targetTreeId}`);
  revalidatePath("/dashboard");
}
