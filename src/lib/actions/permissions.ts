"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/actions/auth";
import { assertUUID } from "@/lib/validate";
import type { TreeRole } from "@/types";

export interface TreePermissions {
  role: TreeRole;
  isOwner: boolean;
  canEdit: boolean;
  linkedNodeId: string | null;
}

export async function getTreePermissions(treeId: string): Promise<TreePermissions> {
  const userId = await getAuthUser();
  assertUUID(treeId, 'treeId');
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
  assertUUID(treeId, 'treeId');
  assertUUID(memberId, 'memberId');
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
  assertUUID(treeId, 'treeId');
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
  assertUUID(treeId, 'treeId');
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
  assertUUID(treeId, 'treeId');
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
  const userId = await getAuthUser();
  assertUUID(treeId, 'treeId');
  const supabase = createAdminClient();

  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("id")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No access to this tree");

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

export interface NodeMembership {
  id: string;
  userId: string;
  role: TreeRole;
  linkedNodeId: string;
  displayName: string;
  avatarUrl: string | null;
}

export async function getNodeMembership(
  treeId: string,
  nodeId: string
): Promise<NodeMembership | null> {
  const userId = await getAuthUser();
  assertUUID(treeId, 'treeId');
  const supabase = createAdminClient();

  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("id")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No access to this tree");

  const { data } = await supabase
    .from("tree_memberships")
    .select("id, user_id, role, linked_node_id, profiles(display_name, avatar_url)")
    .eq("tree_id", treeId)
    .eq("linked_node_id", nodeId)
    .single();

  if (!data) return null;
  const profile = data.profiles as unknown as { display_name: string; avatar_url: string | null } | null;
  return {
    id: data.id,
    userId: data.user_id,
    role: data.role as TreeRole,
    linkedNodeId: data.linked_node_id!,
    displayName: profile?.display_name ?? "Unknown",
    avatarUrl: profile?.avatar_url ?? null,
  };
}

export async function updateMemberRole(
  treeId: string,
  membershipId: string,
  newRole: "editor" | "viewer"
): Promise<void> {
  const userId = await getAuthUser();
  assertUUID(treeId, 'treeId');
  const supabase = createAdminClient();

  // Only owner can change roles
  const { data: callerMembership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!callerMembership || callerMembership.role !== "owner") {
    throw new Error("Only the tree owner can change member roles");
  }

  // Don't allow changing owner role
  const { data: targetMembership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("id", membershipId)
    .eq("tree_id", treeId)
    .single();

  if (!targetMembership) throw new Error("Membership not found");
  if (targetMembership.role === "owner") throw new Error("Cannot change owner role");

  const { error } = await supabase
    .from("tree_memberships")
    .update({ role: newRole })
    .eq("id", membershipId)
    .eq("tree_id", treeId);

  if (error) throw new Error(`Failed to update role: ${error.message}`);
}

export interface MembershipWithActivity {
  id: string;
  tree_id: string;
  user_id: string;
  role: TreeRole;
  linked_node_id: string | null;
  joined_at: string;
  profile?: {
    display_name: string;
    email: string | null;
    avatar_url: string | null;
  };
  last_active: string | null;
}

export async function getTreeMembershipsWithActivity(
  treeId: string
): Promise<MembershipWithActivity[]> {
  const userId = await getAuthUser();
  assertUUID(treeId, 'treeId');
  const supabase = createAdminClient();

  // Verify user has access
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No access to this tree");

  const { data, error } = await supabase
    .from("tree_memberships")
    .select("*, profiles(display_name, email, avatar_url)")
    .eq("tree_id", treeId)
    .limit(500);

  if (error) throw new Error(`Failed to fetch memberships: ${error.message}`);

  // Get last activity from audit_logs per user
  const userIds = (data ?? []).map((m: Record<string, unknown>) => m.user_id as string);
  const activityMap: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: logs } = await supabase
      .from("audit_logs")
      .select("user_id, created_at")
      .eq("tree_id", treeId)
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .limit(500);

    if (logs) {
      for (const log of logs) {
        if (!activityMap[log.user_id]) {
          activityMap[log.user_id] = log.created_at;
        }
      }
    }
  }

  return (data ?? []).map((m: Record<string, unknown>) => ({
    id: m.id as string,
    tree_id: m.tree_id as string,
    user_id: m.user_id as string,
    role: m.role as TreeRole,
    linked_node_id: m.linked_node_id as string | null,
    joined_at: m.joined_at as string,
    profile: m.profiles as MembershipWithActivity["profile"],
    last_active: activityMap[m.user_id as string] ?? null,
  }));
}

export async function revokeMembership(
  treeId: string,
  membershipId: string
): Promise<void> {
  const userId = await getAuthUser();
  assertUUID(treeId, 'treeId');
  const supabase = createAdminClient();

  // Only owner can revoke
  const { data: callerMembership } = await supabase
    .from("tree_memberships")
    .select("role, id")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!callerMembership || callerMembership.role !== "owner") {
    throw new Error("Only the tree owner can revoke memberships");
  }

  // Cannot revoke self
  if (callerMembership.id === membershipId) {
    throw new Error("Cannot revoke your own membership");
  }

  // Cannot revoke another owner
  const { data: targetMembership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("id", membershipId)
    .eq("tree_id", treeId)
    .single();

  if (!targetMembership) throw new Error("Membership not found");
  if (targetMembership.role === "owner") throw new Error("Cannot revoke owner membership");

  const { error } = await supabase
    .from("tree_memberships")
    .delete()
    .eq("id", membershipId)
    .eq("tree_id", treeId);

  if (error) throw new Error(`Failed to revoke membership: ${error.message}`);
}

export async function bulkUpdateRoles(
  treeId: string,
  membershipIds: string[],
  newRole: "editor" | "viewer"
): Promise<void> {
  const userId = await getAuthUser();
  assertUUID(treeId, 'treeId');
  const supabase = createAdminClient();

  const { data: callerMembership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!callerMembership || callerMembership.role !== "owner") {
    throw new Error("Only the tree owner can bulk update roles");
  }

  if (membershipIds.length > 100) throw new Error("Cannot update more than 100 memberships at once");

  const { error } = await supabase
    .from("tree_memberships")
    .update({ role: newRole })
    .eq("tree_id", treeId)
    .in("id", membershipIds)
    .neq("role", "owner");

  if (error) throw new Error(`Failed to bulk update roles: ${error.message}`);
}

export async function bulkRevokeMemberships(
  treeId: string,
  membershipIds: string[]
): Promise<void> {
  const userId = await getAuthUser();
  assertUUID(treeId, 'treeId');
  const supabase = createAdminClient();

  const { data: callerMembership } = await supabase
    .from("tree_memberships")
    .select("role, id")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!callerMembership || callerMembership.role !== "owner") {
    throw new Error("Only the tree owner can bulk revoke memberships");
  }

  if (membershipIds.length > 100) throw new Error("Cannot revoke more than 100 memberships at once");

  // Filter out self and owners
  const { error } = await supabase
    .from("tree_memberships")
    .delete()
    .eq("tree_id", treeId)
    .in("id", membershipIds)
    .neq("role", "owner");

  if (error) throw new Error(`Failed to bulk revoke memberships: ${error.message}`);
}

export async function updateMemberLinkedNode(
  treeId: string,
  membershipId: string,
  nodeId: string | null
): Promise<void> {
  const userId = await getAuthUser();
  assertUUID(treeId, 'treeId');
  const supabase = createAdminClient();

  const { data: callerMembership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!callerMembership || callerMembership.role !== "owner") {
    throw new Error("Only the tree owner can change linked nodes");
  }

  // If setting a node, check it's not already claimed
  if (nodeId) {
    const { data: existing } = await supabase
      .from("tree_memberships")
      .select("id")
      .eq("tree_id", treeId)
      .eq("linked_node_id", nodeId)
      .neq("id", membershipId)
      .single();

    if (existing) throw new Error("This node is already linked to another member");
  }

  const { error } = await supabase
    .from("tree_memberships")
    .update({ linked_node_id: nodeId })
    .eq("id", membershipId)
    .eq("tree_id", treeId);

  if (error) throw new Error(`Failed to update linked node: ${error.message}`);
}
