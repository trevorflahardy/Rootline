"use server";

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTreeSchema, updateTreeSchema } from "@/lib/validators/tree";
import type { CreateTreeInput, UpdateTreeInput } from "@/lib/validators/tree";
import type { FamilyTree, TreeSummary } from "@/types";

async function getAuthUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export async function createTree(input: CreateTreeInput) {
  const userId = await getAuthUserId();
  const validated = createTreeSchema.parse(input);
  const supabase = createAdminClient();

  // Create the tree
  const { data: tree, error: treeError } = await supabase
    .from("family_trees")
    .insert({
      name: validated.name,
      description: validated.description ?? null,
      owner_id: userId,
    })
    .select()
    .single();

  if (treeError) throw new Error(`Failed to create tree: ${treeError.message}`);

  // Create owner membership
  const { error: membershipError } = await supabase
    .from("tree_memberships")
    .insert({
      tree_id: tree.id,
      user_id: userId,
      role: "owner",
    });

  if (membershipError) throw new Error(`Failed to create membership: ${membershipError.message}`);

  return tree as FamilyTree;
}

export async function getTreesForUser(): Promise<TreeSummary[]> {
  const userId = await getAuthUserId();
  const supabase = createAdminClient();

  // Get all tree memberships for this user
  const { data: memberships, error: membershipError } = await supabase
    .from("tree_memberships")
    .select("tree_id, role")
    .eq("user_id", userId);

  if (membershipError) throw new Error(`Failed to fetch memberships: ${membershipError.message}`);
  if (!memberships || memberships.length === 0) return [];

  const treeIds = memberships.map((m) => m.tree_id);

  // Get trees with member counts
  const { data: trees, error: treesError } = await supabase
    .from("family_trees")
    .select("id, name, description, is_public, updated_at")
    .in("id", treeIds);

  if (treesError) throw new Error(`Failed to fetch trees: ${treesError.message}`);

  // Get member counts per tree
  const { data: counts, error: countsError } = await supabase
    .from("tree_members")
    .select("tree_id")
    .in("tree_id", treeIds);

  if (countsError) throw new Error(`Failed to fetch counts: ${countsError.message}`);

  const countMap = new Map<string, number>();
  for (const c of counts ?? []) {
    countMap.set(c.tree_id, (countMap.get(c.tree_id) ?? 0) + 1);
  }

  const roleMap = new Map(memberships.map((m) => [m.tree_id, m.role]));

  return (trees ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    is_public: t.is_public,
    member_count: countMap.get(t.id) ?? 0,
    role: roleMap.get(t.id) as TreeSummary["role"],
    updated_at: t.updated_at,
  }));
}

export async function getTreeById(treeId: string): Promise<FamilyTree | null> {
  const userId = await getAuthUserId();
  const supabase = createAdminClient();

  // Check membership
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) {
    // Check if public
    const { data: tree } = await supabase
      .from("family_trees")
      .select("*")
      .eq("id", treeId)
      .eq("is_public", true)
      .single();

    return tree as FamilyTree | null;
  }

  const { data: tree } = await supabase
    .from("family_trees")
    .select("*")
    .eq("id", treeId)
    .single();

  return tree as FamilyTree | null;
}

export async function updateTree(treeId: string, input: UpdateTreeInput) {
  const userId = await getAuthUserId();
  const validated = updateTreeSchema.parse(input);
  const supabase = createAdminClient();

  // Verify ownership
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership || membership.role !== "owner") {
    throw new Error("Only the owner can update tree settings");
  }

  const { data, error } = await supabase
    .from("family_trees")
    .update(validated)
    .eq("id", treeId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update tree: ${error.message}`);
  return data as FamilyTree;
}

export async function deleteTree(treeId: string) {
  const userId = await getAuthUserId();
  const supabase = createAdminClient();

  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership || membership.role !== "owner") {
    throw new Error("Only the owner can delete a tree");
  }

  const { error } = await supabase
    .from("family_trees")
    .delete()
    .eq("id", treeId);

  if (error) throw new Error(`Failed to delete tree: ${error.message}`);
}
