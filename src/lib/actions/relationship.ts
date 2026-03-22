"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/actions/auth";
import { createRelationshipSchema } from "@/lib/validators/relationship";
import type { CreateRelationshipInput } from "@/lib/validators/relationship";
import type { Relationship } from "@/types";

export async function createRelationship(input: CreateRelationshipInput): Promise<Relationship> {
  const userId = await getAuthUser();
  const validated = createRelationshipSchema.parse(input);
  const supabase = createAdminClient();

  // Check access
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", validated.tree_id)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No access to this tree");
  if (membership.role === "viewer") throw new Error("Viewers cannot add relationships");

  await supabase.rpc("set_request_user_id", { user_id: userId });

  const { data, error } = await supabase
    .from("relationships")
    .insert({
      tree_id: validated.tree_id,
      from_member_id: validated.from_member_id,
      to_member_id: validated.to_member_id,
      relationship_type: validated.relationship_type,
      start_date: validated.start_date ?? null,
      end_date: validated.end_date ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create relationship: ${error.message}`);
  return data as Relationship;
}

export async function deleteRelationship(relationshipId: string, treeId: string) {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership || membership.role !== "owner") {
    throw new Error("Only the owner can delete relationships");
  }

  await supabase.rpc("set_request_user_id", { user_id: userId });

  const { error } = await supabase
    .from("relationships")
    .delete()
    .eq("id", relationshipId)
    .eq("tree_id", treeId);

  if (error) throw new Error(`Failed to delete relationship: ${error.message}`);
}

export async function getRelationshipsByTreeId(treeId: string): Promise<Relationship[]> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No access to this tree");

  const { data, error } = await supabase
    .from("relationships")
    .select("*")
    .eq("tree_id", treeId);

  if (error) throw new Error(`Failed to fetch relationships: ${error.message}`);
  return (data ?? []) as Relationship[];
}
