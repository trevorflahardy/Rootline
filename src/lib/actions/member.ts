"use server";

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMemberSchema, updateMemberSchema } from "@/lib/validators/member";
import type { CreateMemberInput, UpdateMemberInput } from "@/lib/validators/member";
import type { TreeMember } from "@/types";

async function getAuthUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

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
  const userId = await getAuthUserId();
  const validated = createMemberSchema.parse(input);
  const supabase = createAdminClient();

  const membership = await checkTreeAccess(supabase, validated.tree_id, userId);
  if (membership.role === "viewer") throw new Error("Viewers cannot add members");

  // Set the user context for audit triggers
  await supabase.rpc("set_request_user_id", { user_id: userId });

  const { data, error } = await supabase
    .from("tree_members")
    .insert({
      tree_id: validated.tree_id,
      first_name: validated.first_name,
      last_name: validated.last_name ?? null,
      maiden_name: validated.maiden_name ?? null,
      gender: validated.gender ?? null,
      date_of_birth: validated.date_of_birth ?? null,
      date_of_death: validated.date_of_death ?? null,
      birth_place: validated.birth_place ?? null,
      death_place: validated.death_place ?? null,
      bio: validated.bio ?? null,
      is_deceased: validated.is_deceased ?? false,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create member: ${error.message}`);
  return data as TreeMember;
}

export async function updateMember(memberId: string, treeId: string, input: UpdateMemberInput): Promise<TreeMember> {
  const userId = await getAuthUserId();
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

  const { data, error } = await supabase
    .from("tree_members")
    .update(validated)
    .eq("id", memberId)
    .eq("tree_id", treeId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update member: ${error.message}`);
  return data as TreeMember;
}

export async function deleteMember(memberId: string, treeId: string) {
  const userId = await getAuthUserId();
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
  const userId = await getAuthUserId();
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

export async function getMemberById(memberId: string, treeId: string): Promise<TreeMember | null> {
  const userId = await getAuthUserId();
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
