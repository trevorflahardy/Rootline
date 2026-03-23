/**
 * GEDCOM 5.5.1 Exporter
 *
 * Converts tree members and relationships into a GEDCOM format string.
 */

import type { TreeMember, Relationship } from "@/types";

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/**
 * Convert a date string (YYYY-MM-DD, YYYY-MM, or YYYY) to GEDCOM format.
 */
function toGedcomDate(dateStr: string | null): string | null {
  if (!dateStr) return null;

  // YYYY-MM-DD
  const full = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (full) {
    const day = parseInt(full[3], 10);
    const monthIdx = parseInt(full[2], 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${MONTHS[monthIdx]} ${full[1]}`;
    }
  }

  // YYYY-MM
  const partial = dateStr.match(/^(\d{4})-(\d{2})$/);
  if (partial) {
    const monthIdx = parseInt(partial[2], 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${MONTHS[monthIdx]} ${partial[1]}`;
    }
  }

  // YYYY
  const yearOnly = dateStr.match(/^(\d{4})$/);
  if (yearOnly) {
    return yearOnly[1];
  }

  // Return as-is if already in some other format
  return dateStr;
}

// ---------------------------------------------------------------------------
// Gender mapping
// ---------------------------------------------------------------------------

function toGedcomSex(gender: string | null): string | null {
  if (!gender) return null;
  if (gender === "male") return "M";
  if (gender === "female") return "F";
  return "U";
}

// ---------------------------------------------------------------------------
// Family grouping
// ---------------------------------------------------------------------------

interface Family {
  /** Stable key for dedup */
  key: string;
  parentIds: string[];
  childIds: string[];
  relationshipType: "spouse" | "divorced";
}

function buildFamilies(members: TreeMember[], relationships: Relationship[]): Family[] {
  // Identify spouse/divorced pairs
  const couplePairs = relationships.filter(
    (r) => r.relationship_type === "spouse" || r.relationship_type === "divorced"
  );

  // Identify parent-child relationships
  const parentChildRels = relationships.filter(
    (r) => r.relationship_type === "parent_child" || r.relationship_type === "adopted"
  );

  // Build a map: parentId -> childIds
  const parentToChildren = new Map<string, Set<string>>();
  for (const rel of parentChildRels) {
    if (!parentToChildren.has(rel.from_member_id)) {
      parentToChildren.set(rel.from_member_id, new Set());
    }
    parentToChildren.get(rel.from_member_id)!.add(rel.to_member_id);
  }

  const memberSet = new Set(members.map((m) => m.id));
  const families: Family[] = [];
  const usedCouples = new Set<string>();

  // Create families from couple pairs
  for (const couple of couplePairs) {
    if (!memberSet.has(couple.from_member_id) || !memberSet.has(couple.to_member_id)) continue;

    const coupleKey = [couple.from_member_id, couple.to_member_id].sort().join("+");
    if (usedCouples.has(coupleKey)) continue;
    usedCouples.add(coupleKey);

    // Find shared children
    const childrenA = parentToChildren.get(couple.from_member_id) ?? new Set<string>();
    const childrenB = parentToChildren.get(couple.to_member_id) ?? new Set<string>();
    const sharedChildren = [...childrenA].filter((c) => childrenB.has(c));

    families.push({
      key: coupleKey,
      parentIds: [couple.from_member_id, couple.to_member_id],
      childIds: sharedChildren,
      relationshipType: couple.relationship_type as "spouse" | "divorced",
    });
  }

  // Create families for single parents with children not covered above
  const coveredChildren = new Set(families.flatMap((f) => f.childIds));
  for (const [parentId, children] of parentToChildren) {
    if (!memberSet.has(parentId)) continue;
    const uncovered = [...children].filter((c) => !coveredChildren.has(c) && memberSet.has(c));
    if (uncovered.length > 0) {
      families.push({
        key: `single-${parentId}`,
        parentIds: [parentId],
        childIds: uncovered,
        relationshipType: "spouse",
      });
    }
  }

  return families;
}

// ---------------------------------------------------------------------------
// GEDCOM generation
// ---------------------------------------------------------------------------

function memberXref(id: string, idMap: Map<string, number>): string {
  return `@I${idMap.get(id)}@`;
}

function famXref(idx: number): string {
  return `@F${idx + 1}@`;
}

export function exportGedcom(members: TreeMember[], relationships: Relationship[], treeName?: string): string {
  const lines: string[] = [];

  // Build a stable numeric ID map
  const idMap = new Map<string, number>();
  members.forEach((m, i) => idMap.set(m.id, i + 1));

  const families = buildFamilies(members, relationships);

  // Build reverse lookup: memberId -> family xrefs where they appear
  const memberFamS = new Map<string, string[]>(); // as spouse
  const memberFamC = new Map<string, string[]>(); // as child
  families.forEach((fam, idx) => {
    const fx = famXref(idx);
    for (const pid of fam.parentIds) {
      if (!memberFamS.has(pid)) memberFamS.set(pid, []);
      memberFamS.get(pid)!.push(fx);
    }
    for (const cid of fam.childIds) {
      if (!memberFamC.has(cid)) memberFamC.set(cid, []);
      memberFamC.get(cid)!.push(fx);
    }
  });

  // HEAD
  lines.push("0 HEAD");
  lines.push("1 SOUR RootLine");
  lines.push("2 NAME RootLine Family Tree");
  lines.push("2 VERS 1.0");
  lines.push("1 GEDC");
  lines.push("2 VERS 5.5.1");
  lines.push("2 FORM LINEAGE-LINKED");
  lines.push("1 CHAR UTF-8");
  if (treeName) {
    lines.push(`1 NOTE ${treeName}`);
  }

  // INDI records
  for (const member of members) {
    const xref = memberXref(member.id, idMap);
    lines.push(`0 ${xref} INDI`);

    // Name
    const surname = member.last_name ?? "";
    const given = member.first_name;
    lines.push(`1 NAME ${given} /${surname}/`);
    if (given) lines.push(`2 GIVN ${given}`);
    if (surname) lines.push(`2 SURN ${surname}`);
    if (member.maiden_name) lines.push(`2 _MARNM ${member.maiden_name}`);

    // Sex
    const sex = toGedcomSex(member.gender);
    if (sex) lines.push(`1 SEX ${sex}`);

    // Birth
    if (member.date_of_birth || member.birth_place) {
      lines.push("1 BIRT");
      const gd = toGedcomDate(member.date_of_birth);
      if (gd) lines.push(`2 DATE ${gd}`);
      if (member.birth_place) lines.push(`2 PLAC ${member.birth_place}`);
    }

    // Death
    if (member.is_deceased || member.date_of_death || member.death_place) {
      lines.push("1 DEAT");
      const gd = toGedcomDate(member.date_of_death);
      if (gd) lines.push(`2 DATE ${gd}`);
      if (member.death_place) lines.push(`2 PLAC ${member.death_place}`);
    }

    // Family links
    const famS = memberFamS.get(member.id) ?? [];
    for (const fx of famS) lines.push(`1 FAMS ${fx}`);
    const famC = memberFamC.get(member.id) ?? [];
    for (const fx of famC) lines.push(`1 FAMC ${fx}`);

    // Notes
    if (member.bio) {
      lines.push(`1 NOTE ${member.bio.split("\n")[0]}`);
      for (const extra of member.bio.split("\n").slice(1)) {
        lines.push(`2 CONT ${extra}`);
      }
    }
  }

  // FAM records
  families.forEach((fam, idx) => {
    const fx = famXref(idx);
    lines.push(`0 ${fx} FAM`);

    // Parents — use HUSB/WIFE based on gender or order
    const parents = fam.parentIds.map((pid) => members.find((m) => m.id === pid)!).filter(Boolean);
    const husb = parents.find((p) => p.gender === "male") ?? parents[0];
    const wife = parents.find((p) => p.gender === "female") ?? parents[1];

    if (husb) lines.push(`1 HUSB ${memberXref(husb.id, idMap)}`);
    if (wife && wife.id !== husb?.id) lines.push(`1 WIFE ${memberXref(wife.id, idMap)}`);

    for (const cid of fam.childIds) {
      lines.push(`1 CHIL ${memberXref(cid, idMap)}`);
    }
  });

  // TRLR
  lines.push("0 TRLR");

  return lines.join("\n") + "\n";
}
