import { createAdminClient } from "@/lib/supabase/admin";
import { assertUUID } from "@/lib/validate";
import type { FamilyTree, TreeMember } from "@/types";

export interface PublicRelationship {
  id: string;
  tree_id: string;
  from_member_id: string;
  to_member_id: string;
  relationship_type: string;
}

export async function getPublicTree(treeId: string): Promise<FamilyTree | null> {
  assertUUID(treeId, "treeId");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("family_trees")
    .select("*")
    .eq("id", treeId)
    .eq("is_public", true)
    .single();
  return data as FamilyTree | null;
}

export async function getPublicMembers(treeId: string): Promise<TreeMember[]> {
  assertUUID(treeId, "treeId");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("tree_members")
    .select("*")
    .eq("tree_id", treeId);
  return (data ?? []) as TreeMember[];
}

export async function getPublicRelationships(treeId: string): Promise<PublicRelationship[]> {
  assertUUID(treeId, "treeId");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("relationships")
    .select("id, tree_id, from_member_id, to_member_id, relationship_type")
    .eq("tree_id", treeId);
  return (data ?? []) as PublicRelationship[];
}
