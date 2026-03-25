"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/actions/auth";
import { assertUUID } from "@/lib/validate";
import type { TimelineEvent } from "@/types/timeline";

export async function getTimelineEvents(treeId: string): Promise<TimelineEvent[]> {
  const userId = await getAuthUser();
  assertUUID(treeId, 'treeId');
  const supabase = createAdminClient();

  // Verify access
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();
  if (!membership) throw new Error("No access to this tree");

  // Fetch members
  const { data: members, error: membersError } = await supabase
    .from("tree_members")
    .select("id, first_name, last_name, date_of_birth, date_of_death, birth_place, death_place, is_deceased")
    .eq("tree_id", treeId);
  if (membersError) throw new Error(membersError.message);

  // Fetch relationships (spouse + divorced only — these have named people)
  // start_date is used for marriage date, end_date for divorce date
  const { data: relationships, error: relError } = await supabase
    .from("relationships")
    .select("id, from_member_id, to_member_id, relationship_type, start_date, end_date")
    .eq("tree_id", treeId)
    .in("relationship_type", ["spouse", "divorced"]);
  if (relError) throw new Error(relError.message);

  const events: TimelineEvent[] = [];
  const memberMap = new Map((members ?? []).map((m) => [m.id, m]));

  const fullName = (m: { first_name: string; last_name: string | null }) =>
    [m.first_name, m.last_name].filter(Boolean).join(" ");

  const parseYear = (date: string): number => parseInt(date.substring(0, 4), 10);
  const toDecade = (year: number): number => Math.floor(year / 10) * 10;

  // Birth and death events from members
  for (const member of members ?? []) {
    if (member.date_of_birth) {
      const year = parseYear(member.date_of_birth);
      if (!isNaN(year)) {
        events.push({
          id: `birth-${member.id}`,
          type: 'birth',
          date: member.date_of_birth,
          year,
          decade: toDecade(year),
          memberId: member.id,
          memberName: fullName(member),
          place: member.birth_place ?? null,
        });
      }
    }
    if (member.date_of_death) {
      const year = parseYear(member.date_of_death);
      if (!isNaN(year)) {
        events.push({
          id: `death-${member.id}`,
          type: 'death',
          date: member.date_of_death,
          year,
          decade: toDecade(year),
          memberId: member.id,
          memberName: fullName(member),
          place: member.death_place ?? null,
        });
      }
    }
  }

  // Marriage and divorce events from relationships with dated start_date / end_date
  const seenMarriages = new Set<string>();
  for (const rel of relationships ?? []) {
    const fromMember = memberMap.get(rel.from_member_id);
    const toMember = memberMap.get(rel.to_member_id);
    if (!fromMember || !toMember) continue;

    // Deduplicate: spouse relationships may appear in both directions
    const pairKey = [rel.from_member_id, rel.to_member_id].sort().join('-');

    if (rel.start_date) {
      const year = parseYear(rel.start_date);
      if (!isNaN(year)) {
        const marriageKey = `marriage-${pairKey}`;
        if (!seenMarriages.has(marriageKey)) {
          seenMarriages.add(marriageKey);
          events.push({
            id: `marriage-${rel.id}`,
            type: 'marriage',
            date: rel.start_date,
            year,
            decade: toDecade(year),
            memberId: rel.from_member_id,
            memberName: fullName(fromMember),
            place: null,
            relatedMemberId: rel.to_member_id,
            relatedMemberName: fullName(toMember),
          });
        }
      }
    }

    if (rel.end_date && rel.relationship_type === 'divorced') {
      const year = parseYear(rel.end_date);
      if (!isNaN(year)) {
        const divorceKey = `divorce-${pairKey}`;
        if (!seenMarriages.has(divorceKey)) {
          seenMarriages.add(divorceKey);
          events.push({
            id: `divorce-${rel.id}`,
            type: 'divorce',
            date: rel.end_date,
            year,
            decade: toDecade(year),
            memberId: rel.from_member_id,
            memberName: fullName(fromMember),
            place: null,
            relatedMemberId: rel.to_member_id,
            relatedMemberName: fullName(toMember),
          });
        }
      }
    }
  }

  // Sort chronologically
  events.sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return 0;
  });

  return events;
}
