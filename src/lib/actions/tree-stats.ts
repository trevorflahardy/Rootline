"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/actions/auth";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/rate-limit-config";

export interface TreeStats {
  // Member counts
  totalMembers: number;
  livingMembers: number;
  deceasedMembers: number;

  // Lifespan (deceased only with both dates)
  averageLifespanYears: number | null; // null if no data
  longestLifespanYears: number | null;
  longestLifespanMember: { id: string; name: string } | null;

  // Oldest living (living members with date_of_birth)
  oldestLivingMember: { id: string; name: string; age: number } | null;

  // Gender distribution
  genderCounts: { male: number; female: number; other: number; unknown: number };

  // Profile completeness
  completenessPercent: number; // % of members with first_name + last_name + date_of_birth
  fieldBreakdown: {
    withDob: number;
    withDod: number; // deceased only
    withBio: number;
    withPhoto: number; // members with avatar_url set
  };

  // Activity
  mostRecentlyAdded: { id: string; name: string; addedAt: string } | null;
  mostRecentlyUpdated: { id: string; name: string; updatedAt: string } | null;

  // Depth: max number of parent_child hops from any root to any leaf
  maxGenerations: number;
}

/**
 * Computes a comprehensive statistics snapshot for a family tree.
 * Includes member counts, lifespan metrics, gender distribution,
 * profile completeness, activity, and generation depth.
 */
export async function getTreeStats(treeId: string): Promise<TreeStats> {
  const userId = await getAuthUser();
  rateLimit(userId, "getTreeStats", ...RATE_LIMITS.getTreeStats);
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
    .select(
      "id, first_name, last_name, date_of_birth, date_of_death, is_deceased, gender, bio, avatar_url, created_at, updated_at"
    )
    .eq("tree_id", treeId);

  if (membersError) throw new Error(`Failed to fetch members: ${membersError.message}`);

  const allMembers = members ?? [];
  const totalMembers = allMembers.length;

  if (totalMembers === 0) {
    return {
      totalMembers: 0,
      livingMembers: 0,
      deceasedMembers: 0,
      averageLifespanYears: null,
      longestLifespanYears: null,
      longestLifespanMember: null,
      oldestLivingMember: null,
      genderCounts: { male: 0, female: 0, other: 0, unknown: 0 },
      completenessPercent: 0,
      fieldBreakdown: { withDob: 0, withDod: 0, withBio: 0, withPhoto: 0 },
      mostRecentlyAdded: null,
      mostRecentlyUpdated: null,
      maxGenerations: 0,
    };
  }

  // Fetch parent_child relationships for generation depth
  const { data: relationships, error: relError } = await supabase
    .from("relationships")
    .select("from_member_id, to_member_id")
    .eq("tree_id", treeId)
    .eq("relationship_type", "parent_child");

  if (relError) throw new Error(`Failed to fetch relationships: ${relError.message}`);

  const rels = relationships ?? [];

  // ── Member counts ──────────────────────────────────────────────────────────
  const deceasedMembers = allMembers.filter((m) => m.is_deceased).length;
  const livingMembers = totalMembers - deceasedMembers;

  // ── Lifespan (deceased with both dates) ───────────────────────────────────
  type MemberRow = (typeof allMembers)[number];

  const withLifespan = allMembers.filter(
    (m): m is MemberRow & { date_of_birth: string; date_of_death: string } =>
      m.is_deceased && !!m.date_of_birth && !!m.date_of_death
  );

  const lifespanEntries = withLifespan.map((m) => ({
    id: m.id,
    name: [m.first_name, m.last_name].filter(Boolean).join(" "),
    years: Math.floor(
      (new Date(m.date_of_death).getTime() - new Date(m.date_of_birth).getTime()) /
        (1000 * 60 * 60 * 24 * 365.25)
    ),
  }));

  let averageLifespanYears: number | null = null;
  let longestLifespanYears: number | null = null;
  let longestLifespanMember: { id: string; name: string } | null = null;

  if (lifespanEntries.length > 0) {
    const total = lifespanEntries.reduce((sum, e) => sum + e.years, 0);
    averageLifespanYears = Math.floor(total / lifespanEntries.length);

    const longest = lifespanEntries.reduce((best, e) => (e.years > best.years ? e : best));
    longestLifespanYears = longest.years;
    longestLifespanMember = { id: longest.id, name: longest.name };
  }

  // ── Oldest living ──────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();

  const livingWithDob = allMembers.filter(
    (m): m is MemberRow & { date_of_birth: string } => !m.is_deceased && !!m.date_of_birth
  );

  let oldestLivingMember: { id: string; name: string; age: number } | null = null;

  if (livingWithDob.length > 0) {
    const oldest = livingWithDob.reduce((best, m) =>
      m.date_of_birth < best.date_of_birth ? m : best
    );
    const age = currentYear - new Date(oldest.date_of_birth).getFullYear();
    oldestLivingMember = {
      id: oldest.id,
      name: [oldest.first_name, oldest.last_name].filter(Boolean).join(" "),
      age,
    };
  }

  // ── Gender distribution ────────────────────────────────────────────────────
  const genderCounts = { male: 0, female: 0, other: 0, unknown: 0 };
  for (const m of allMembers) {
    const g = m.gender?.toLowerCase();
    if (g === "male") genderCounts.male++;
    else if (g === "female") genderCounts.female++;
    else if (g && g !== "unknown") genderCounts.other++;
    else genderCounts.unknown++;
  }

  // ── Profile completeness ──────────────────────────────────────────────────
  const completeMembers = allMembers.filter(
    (m) => m.first_name && m.last_name && m.date_of_birth
  ).length;
  const completenessPercent = Math.round((completeMembers / totalMembers) * 100);

  const withDob = allMembers.filter((m) => !!m.date_of_birth).length;
  const withDod = allMembers.filter((m) => m.is_deceased && !!m.date_of_death).length;
  const withBio = allMembers.filter((m) => !!m.bio).length;
  const withPhoto = allMembers.filter((m) => !!m.avatar_url).length;

  // ── Activity ──────────────────────────────────────────────────────────────
  let mostRecentlyAdded: { id: string; name: string; addedAt: string } | null = null;
  let mostRecentlyUpdated: { id: string; name: string; updatedAt: string } | null = null;

  const withCreated = allMembers.filter((m) => !!m.created_at);
  if (withCreated.length > 0) {
    const newest = withCreated.reduce((best, m) =>
      (m.created_at ?? "") > (best.created_at ?? "") ? m : best
    );
    mostRecentlyAdded = {
      id: newest.id,
      name: [newest.first_name, newest.last_name].filter(Boolean).join(" "),
      addedAt: newest.created_at!,
    };
  }

  const withUpdated = allMembers.filter((m) => !!m.updated_at);
  if (withUpdated.length > 0) {
    const lastUpdated = withUpdated.reduce((best, m) =>
      (m.updated_at ?? "") > (best.updated_at ?? "") ? m : best
    );
    mostRecentlyUpdated = {
      id: lastUpdated.id,
      name: [lastUpdated.first_name, lastUpdated.last_name].filter(Boolean).join(" "),
      updatedAt: lastUpdated.updated_at!,
    };
  }

  // ── Generation depth (BFS from roots) ────────────────────────────────────
  // Build child→parent map: from_member_id is the parent, to_member_id is the child
  const childToParents = new Map<string, Set<string>>();
  const parentToChildren = new Map<string, Set<string>>();

  for (const rel of rels) {
    if (!childToParents.has(rel.to_member_id)) childToParents.set(rel.to_member_id, new Set());
    childToParents.get(rel.to_member_id)!.add(rel.from_member_id);

    if (!parentToChildren.has(rel.from_member_id))
      parentToChildren.set(rel.from_member_id, new Set());
    parentToChildren.get(rel.from_member_id)!.add(rel.to_member_id);
  }

  // Root nodes: members that have no parents in the parent_child graph
  const memberIds = new Set(allMembers.map((m) => m.id));
  const roots = allMembers
    .filter((m) => !childToParents.has(m.id) || childToParents.get(m.id)!.size === 0)
    .map((m) => m.id);

  let maxGenerations = 0;
  const MAX_DEPTH = 50;

  // BFS from all roots simultaneously, tracking depth per node
  const depthMap = new Map<string, number>();
  const queue: Array<{ id: string; depth: number }> = [];

  for (const rootId of roots) {
    if (memberIds.has(rootId)) {
      depthMap.set(rootId, 0);
      queue.push({ id: rootId, depth: 0 });
    }
  }

  let head = 0;
  while (head < queue.length) {
    const { id, depth } = queue[head++];
    if (depth >= MAX_DEPTH) continue;

    const children = parentToChildren.get(id);
    if (!children) continue;

    for (const childId of children) {
      if (!memberIds.has(childId)) continue;
      const newDepth = depth + 1;
      const existing = depthMap.get(childId);
      if (existing === undefined || newDepth > existing) {
        depthMap.set(childId, newDepth);
        if (newDepth > maxGenerations) maxGenerations = newDepth;
        queue.push({ id: childId, depth: newDepth });
      }
    }
  }

  // maxGenerations is 0-indexed hops; convert to generation count (hops + 1) only if tree has members
  const generationCount = maxGenerations > 0 ? maxGenerations + 1 : roots.length > 0 ? 1 : 0;

  return {
    totalMembers,
    livingMembers,
    deceasedMembers,
    averageLifespanYears,
    longestLifespanYears,
    longestLifespanMember,
    oldestLivingMember,
    genderCounts,
    completenessPercent,
    fieldBreakdown: { withDob, withDod, withBio, withPhoto },
    mostRecentlyAdded,
    mostRecentlyUpdated,
    maxGenerations: generationCount,
  };
}
