"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/actions/auth";
import { createRelationshipSchema } from "@/lib/validators/relationship";
import { updateRelationshipSchema } from "@/lib/validators/relationship";
import type { CreateRelationshipInput } from "@/lib/validators/relationship";
import type { UpdateRelationshipInput } from "@/lib/validators/relationship";
import type { Relationship } from "@/types";
import { rateLimit } from "@/lib/rate-limit";
import { assertUUID } from "@/lib/validate";

export async function createRelationship(input: CreateRelationshipInput): Promise<Relationship> {
  const userId = await getAuthUser();
  rateLimit(userId, 'createRelationship', 30, 60_000);
  const validated = createRelationshipSchema.parse(input);
  const supabase = createAdminClient();

  // Check access
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role, linked_node_id")
    .eq("tree_id", validated.tree_id)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No access to this tree");
  if (membership.role === "viewer") throw new Error("Viewers cannot add relationships");

  // Editors with linked node can only create relationships within their branch
  if (membership.role === "editor" && membership.linked_node_id) {
    const [fromResult, toResult] = await Promise.all([
      supabase.rpc("is_descendant_of", {
        p_tree_id: validated.tree_id,
        p_node_id: validated.from_member_id,
        p_ancestor_id: membership.linked_node_id,
      }),
      supabase.rpc("is_descendant_of", {
        p_tree_id: validated.tree_id,
        p_node_id: validated.to_member_id,
        p_ancestor_id: membership.linked_node_id,
      }),
    ]);
    if (!fromResult.data || !toResult.data) {
      throw new Error("You can only create relationships within your branch");
    }
  }

  if (validated.relationship_type === "spouse") {
    const { data: existingSpouse, error: spouseCheckError } = await supabase
      .from("relationships")
      .select("id")
      .eq("tree_id", validated.tree_id)
      .eq("relationship_type", "spouse")
      .or(
        `and(from_member_id.eq.${validated.from_member_id},to_member_id.eq.${validated.to_member_id}),and(from_member_id.eq.${validated.to_member_id},to_member_id.eq.${validated.from_member_id})`
      )
      .limit(1)
      .maybeSingle();

    if (spouseCheckError) {
      throw new Error(`Failed to check existing spouse relationship: ${spouseCheckError.message}`);
    }

    if (existingSpouse) {
      throw new Error("A spouse relationship between these members already exists");
    }
  }

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

  if (error) {
    // Duplicate relationship — return the existing row (idempotent for non-spouse types)
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("relationships")
        .select()
        .eq("tree_id", validated.tree_id)
        .eq("from_member_id", validated.from_member_id)
        .eq("to_member_id", validated.to_member_id)
        .eq("relationship_type", validated.relationship_type)
        .maybeSingle();
      if (existing) return existing as Relationship;
    }
    throw new Error(`Failed to create relationship: ${error.message}`);
  }
  return data as Relationship;
}

export async function deleteRelationship(relationshipId: string, treeId: string) {
  const userId = await getAuthUser();
  rateLimit(userId, 'deleteRelationship', 30, 60_000);
  assertUUID(relationshipId, 'relationshipId');
  assertUUID(treeId, 'treeId');
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

export async function updateRelationship(input: UpdateRelationshipInput): Promise<Relationship> {
  const userId = await getAuthUser();
  rateLimit(userId, 'updateRelationship', 60, 60_000);
  const validated = updateRelationshipSchema.parse(input);
  const supabase = createAdminClient();

  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role, linked_node_id")
    .eq("tree_id", validated.tree_id)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No access to this tree");
  if (membership.role === "viewer") throw new Error("Viewers cannot edit relationships");

  if (membership.role === "editor" && membership.linked_node_id) {
    const [fromResult, toResult] = await Promise.all([
      supabase.rpc("is_descendant_of", {
        p_tree_id: validated.tree_id,
        p_node_id: validated.from_member_id,
        p_ancestor_id: membership.linked_node_id,
      }),
      supabase.rpc("is_descendant_of", {
        p_tree_id: validated.tree_id,
        p_node_id: validated.to_member_id,
        p_ancestor_id: membership.linked_node_id,
      }),
    ]);
    if (!fromResult.data || !toResult.data) {
      throw new Error("You can only edit relationships within your branch");
    }
  }

  if (validated.relationship_type === "spouse") {
    const { data: existingSpouse, error: spouseCheckError } = await supabase
      .from("relationships")
      .select("id")
      .eq("tree_id", validated.tree_id)
      .eq("relationship_type", "spouse")
      .neq("id", validated.relationship_id)
      .or(
        `and(from_member_id.eq.${validated.from_member_id},to_member_id.eq.${validated.to_member_id}),and(from_member_id.eq.${validated.to_member_id},to_member_id.eq.${validated.from_member_id})`
      )
      .limit(1)
      .maybeSingle();

    if (spouseCheckError) {
      throw new Error(`Failed to check existing spouse relationship: ${spouseCheckError.message}`);
    }

    if (existingSpouse) {
      throw new Error("A spouse relationship between these members already exists");
    }
  }

  await supabase.rpc("set_request_user_id", { user_id: userId });

  const { data, error } = await supabase
    .from("relationships")
    .update({
      from_member_id: validated.from_member_id,
      to_member_id: validated.to_member_id,
      relationship_type: validated.relationship_type,
    })
    .eq("id", validated.relationship_id)
    .eq("tree_id", validated.tree_id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update relationship: ${error.message}`);
  return data as Relationship;
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
