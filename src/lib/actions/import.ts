"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/actions/auth";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { assertUUID } from "@/lib/validate";
import type { ParsedMember, ParsedRelationship } from "@/lib/utils/gedcom-parser";
import type { TreeMember, Relationship } from "@/types";

export async function importGedcomData(
  treeId: string,
  members: ParsedMember[],
  relationships: ParsedRelationship[]
): Promise<{ members: TreeMember[]; relationships: Relationship[]; errors: string[] }> {
  const userId = await getAuthUser();
  await rateLimit(userId, 'importGedcom', 5, 60_000);
  assertUUID(treeId, 'treeId');
  const supabase = createAdminClient();
  const errors: string[] = [];

  // Check tree access
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No access to this tree");
  if (membership.role === "viewer") throw new Error("Viewers cannot import data");

  await supabase.rpc("set_request_user_id", { user_id: userId });

  // Insert members and build a mapping from gedcom_id -> real UUID
  const gedcomToDbId = new Map<string, string>();
  const createdMembers: TreeMember[] = [];

  for (const member of members) {
    const orNull = (v: string | null | undefined) =>
      v && v.trim() !== "" ? v : null;

    const { data, error } = await supabase
      .from("tree_members")
      .insert({
        tree_id: treeId,
        first_name: sanitizeText(member.first_name),
        last_name: orNull(member.last_name ? sanitizeText(member.last_name) : null),
        maiden_name: orNull(member.maiden_name ? sanitizeText(member.maiden_name) : null),
        gender: orNull(member.gender ? sanitizeText(member.gender) : null),
        date_of_birth: orNull(member.date_of_birth ? sanitizeText(member.date_of_birth) : null),
        date_of_death: orNull(member.date_of_death ? sanitizeText(member.date_of_death) : null),
        birth_place: orNull(member.birth_place ? sanitizeText(member.birth_place) : null),
        death_place: orNull(member.death_place ? sanitizeText(member.death_place) : null),
        bio: orNull(member.bio ? sanitizeText(member.bio) : null),
        is_deceased: member.is_deceased,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      errors.push(`Failed to create member "${member.first_name}": ${error.message}`);
      continue;
    }

    gedcomToDbId.set(member.gedcom_id, data.id);
    createdMembers.push(data as TreeMember);
  }

  // Insert relationships
  const createdRelationships: Relationship[] = [];

  for (const rel of relationships) {
    const fromId = gedcomToDbId.get(rel.from_gedcom_id);
    const toId = gedcomToDbId.get(rel.to_gedcom_id);

    if (!fromId || !toId) {
      errors.push(
        `Skipped relationship: could not resolve member IDs (${rel.from_gedcom_id} -> ${rel.to_gedcom_id})`
      );
      continue;
    }

    const { data, error } = await supabase
      .from("relationships")
      .insert({
        tree_id: treeId,
        from_member_id: fromId,
        to_member_id: toId,
        relationship_type: rel.relationship_type,
      })
      .select()
      .single();

    if (error) {
      errors.push(`Failed to create relationship: ${error.message}`);
      continue;
    }

    createdRelationships.push(data as Relationship);
  }

  return {
    members: createdMembers,
    relationships: createdRelationships,
    errors,
  };
}
