"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/actions/auth";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/rate-limit-config";

export interface TreeHealthData {
  percentage: number;
  totalMembers: number;
  completeMembers: number;
  newToday: number;
}

/**
 * Calculates tree "health" — the percentage of members with complete profiles.
 * Complete = has first_name + last_name + date_of_birth + at least 1 relationship.
 */
export async function getTreeHealth(treeId: string): Promise<TreeHealthData> {
  const userId = await getAuthUser();
  rateLimit(userId, "getTreeHealth", ...RATE_LIMITS.getTreeHealth);
  const supabase = createAdminClient();

  // Verify access
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No access to this tree");

  // Fetch all members
  const { data: members, error: membersError } = await supabase
    .from("tree_members")
    .select("id, first_name, last_name, date_of_birth, created_at")
    .eq("tree_id", treeId);

  if (membersError) throw new Error(`Failed to fetch members: ${membersError.message}`);

  const allMembers = members ?? [];
  const totalMembers = allMembers.length;

  if (totalMembers === 0) {
    return { percentage: 0, totalMembers: 0, completeMembers: 0, newToday: 0 };
  }

  // Get member IDs that have at least one relationship
  const { data: relationships, error: relError } = await supabase
    .from("relationships")
    .select("from_member_id, to_member_id")
    .eq("tree_id", treeId);

  if (relError) throw new Error(`Failed to fetch relationships: ${relError.message}`);

  const membersWithRelationships = new Set<string>();
  for (const rel of relationships ?? []) {
    membersWithRelationships.add(rel.from_member_id);
    membersWithRelationships.add(rel.to_member_id);
  }

  // Count complete members: first_name + last_name + date_of_birth + at least 1 relationship
  const completeMembers = allMembers.filter(
    (m) => m.first_name && m.last_name && m.date_of_birth && membersWithRelationships.has(m.id)
  ).length;

  // Count members created in the last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const newToday = allMembers.filter((m) => m.created_at && m.created_at >= oneDayAgo).length;

  const percentage = Math.round((completeMembers / totalMembers) * 100);

  return { percentage, totalMembers, completeMembers, newToday };
}
