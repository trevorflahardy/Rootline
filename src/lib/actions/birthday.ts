"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/actions/auth";
import { assertUUID } from "@/lib/validate";

export interface BirthdayReminder {
  memberId: string;
  name: string;
  daysUntil: number;
  dateOfBirth: string; // ISO date string
  avatarUrl: string | null;
}

function daysUntilBirthday(dob: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Parse YYYY-MM-DD parts directly to avoid UTC vs local timezone shift
  // when Date("YYYY-MM-DD") is interpreted as UTC midnight.
  const [, mm, dd] = dob.split("-").map(Number);
  const thisYear = new Date(today.getFullYear(), mm - 1, dd);
  if (thisYear < today) {
    thisYear.setFullYear(today.getFullYear() + 1);
  }
  return Math.round((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Returns upcoming birthday reminders for living members of the given tree
 * whose birthday falls within the next 7 days (inclusive of today).
 *
 * @param treeId - UUID of the family tree
 * @returns Array of BirthdayReminder sorted by days ascending
 * @throws If the user is not authenticated or has no access to the tree
 */
export async function getBirthdayReminders(treeId: string): Promise<BirthdayReminder[]> {
  const userId = await getAuthUser();
  assertUUID(treeId, "treeId");

  const supabase = createAdminClient();

  // Verify the user has access to this tree
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) {
    throw new Error("No access to this tree");
  }

  // Fetch living members who have a date_of_birth
  const { data: members, error } = await supabase
    .from("tree_members")
    .select("id, first_name, last_name, date_of_birth, avatar_url")
    .eq("tree_id", treeId)
    .not("date_of_birth", "is", null)
    .is("date_of_death", null);

  if (error) {
    throw new Error(`Failed to fetch members: ${error.message}`);
  }

  if (!members) return [];

  return members
    .filter((m) => m.date_of_birth !== null)
    .map((m) => ({
      memberId: m.id as string,
      name: `${m.first_name}${m.last_name ? ` ${m.last_name}` : ""}`,
      daysUntil: daysUntilBirthday(m.date_of_birth as string),
      dateOfBirth: m.date_of_birth as string,
      avatarUrl: (m.avatar_url as string | null) ?? null,
    }))
    .filter((r) => r.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
