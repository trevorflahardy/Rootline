"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/actions/auth";
import type { TreeRole } from "@/types";

export interface TreePermissions {
  role: TreeRole;
  isOwner: boolean;
  canEdit: boolean;
  linkedNodeId: string | null;
}

export async function getTreePermissions(treeId: string): Promise<TreePermissions> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role, linked_node_id")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) {
    return { role: "viewer", isOwner: false, canEdit: false, linkedNodeId: null };
  }

  return {
    role: membership.role as TreeRole,
    isOwner: membership.role === "owner",
    canEdit: membership.role === "owner" || membership.role === "editor",
    linkedNodeId: membership.linked_node_id,
  };
}

export async function canEditMember(
  treeId: string,
  memberId: string
): Promise<boolean> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role, linked_node_id")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) return false;
  if (membership.role === "owner") return true;
  if (membership.role === "viewer") return false;

  // Editor: check descendant scope
  if (membership.linked_node_id) {
    const { data: isDescendant } = await supabase.rpc("is_descendant_of", {
      p_tree_id: treeId,
      p_node_id: memberId,
      p_ancestor_id: membership.linked_node_id,
    });
    return !!isDescendant;
  }

  // Editor with no linked node can edit all
  return true;
}

export async function selfAssignToNode(
  treeId: string,
  nodeId: string
): Promise<void> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("id, linked_node_id")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No membership in this tree");
  if (membership.linked_node_id) throw new Error("You are already assigned to a node");

  // Check that the node isn't already claimed by someone else
  const { data: existing } = await supabase
    .from("tree_memberships")
    .select("id")
    .eq("tree_id", treeId)
    .eq("linked_node_id", nodeId)
    .single();

  if (existing) throw new Error("This node is already claimed by another member");

  // Verify the node exists
  const { data: node } = await supabase
    .from("tree_members")
    .select("id")
    .eq("id", nodeId)
    .eq("tree_id", treeId)
    .single();

  if (!node) throw new Error("Node not found");

  const { error } = await supabase
    .from("tree_memberships")
    .update({ linked_node_id: nodeId })
    .eq("id", membership.id);

  if (error) throw new Error(`Failed to assign: ${error.message}`);
}

export async function selfUnassignFromNode(treeId: string): Promise<void> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("id, linked_node_id")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No membership in this tree");
  if (!membership.linked_node_id) throw new Error("You are not assigned to any node");

  const { error } = await supabase
    .from("tree_memberships")
    .update({ linked_node_id: null })
    .eq("id", membership.id);

  if (error) throw new Error(`Failed to unassign: ${error.message}`);
}

export async function unlinkNodeProfile(
  treeId: string,
  membershipId: string
): Promise<void> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  // Only owner can unlink others
  const { data: callerMembership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!callerMembership || callerMembership.role !== "owner") {
    throw new Error("Only the tree owner can unlink profiles");
  }

  const { error } = await supabase
    .from("tree_memberships")
    .update({ linked_node_id: null })
    .eq("id", membershipId)
    .eq("tree_id", treeId);

  if (error) throw new Error(`Failed to unlink: ${error.message}`);
}

export interface NodeProfileLink {
  userId: string;
  membershipId: string;
  displayName: string;
  avatarUrl: string | null;
}

export async function getNodeProfileMap(
  treeId: string
): Promise<Record<string, NodeProfileLink>> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("tree_memberships")
    .select("id, user_id, linked_node_id, profiles(display_name, avatar_url)")
    .eq("tree_id", treeId)
    .not("linked_node_id", "is", null);

  if (error) throw new Error(`Failed to fetch node profiles: ${error.message}`);

  const map: Record<string, NodeProfileLink> = {};
  for (const m of data ?? []) {
    if (m.linked_node_id) {
      const profile = m.profiles as unknown as { display_name: string; avatar_url: string | null } | null;
      map[m.linked_node_id] = {
        userId: m.user_id,
        membershipId: m.id,
        displayName: profile?.display_name ?? "Unknown",
        avatarUrl: profile?.avatar_url ?? null,
      };
    }
  }
  return map;
}
