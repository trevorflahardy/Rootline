"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/actions/auth";
import { createMemberSchema, updateMemberSchema } from "@/lib/validators/member";
import type { CreateMemberInput, UpdateMemberInput } from "@/lib/validators/member";
import type { TreeMember } from "@/types";

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
  const validated = createMemberSchema.parse(input);
  const supabase = createAdminClient();

  const membership = await checkTreeAccess(supabase, validated.tree_id, userId);
  if (membership.role === "viewer") throw new Error("Viewers cannot add members");

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
      birth_place: orNull(validated.birth_place),
      death_place: orNull(validated.death_place),
      bio: orNull(validated.bio),
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
    Object.entries(validated).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v])
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

  // Batch update positions
  for (const pos of positions) {
    await supabase
      .from("tree_members")
      .update({ position_x: pos.position_x, position_y: pos.position_y })
      .eq("id", pos.id)
      .eq("tree_id", treeId);
  }
}

export async function getMemberById(memberId: string, treeId: string): Promise<TreeMember | null> {
  const userId = await getAuthUser();
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
