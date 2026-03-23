/**
 * GEDCOM 5.5.1 Parser
 *
 * Parses GEDCOM format text into structured data compatible with the
 * tree_members and relationships tables.
 */

import type { Gender } from "@/types";
import type { RelationshipType } from "@/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ParsedMember {
  /** Temporary ID used only during import to wire up relationships */
  gedcom_id: string;
  first_name: string;
  last_name: string | null;
  maiden_name: string | null;
  gender: Gender | null;
  date_of_birth: string | null;
  date_of_death: string | null;
  birth_place: string | null;
  death_place: string | null;
  bio: string | null;
  is_deceased: boolean;
}

export interface ParsedRelationship {
  from_gedcom_id: string;
  to_gedcom_id: string;
  relationship_type: RelationshipType;
}

export interface GedcomParseResult {
  members: ParsedMember[];
  relationships: ParsedRelationship[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface GedcomLine {
  level: number;
  xref: string | null;
  tag: string;
  value: string;
  lineNum: number;
}

interface IndiRecord {
  xref: string;
  givenName: string;
  surname: string;
  maidenName: string | null;
  sex: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathPlace: string | null;
  isDeceased: boolean;
  notes: string[];
}

interface FamRecord {
  xref: string;
  husbXref: string | null;
  wifeXref: string | null;
  childXrefs: string[];
}

// ---------------------------------------------------------------------------
// Line parser
// ---------------------------------------------------------------------------

const LINE_RE = /^(\d+)\s+(@[^@]+@\s+)?(\S+)\s?(.*)?$/;

function parseLines(text: string): GedcomLine[] {
  const lines: GedcomLine[] = [];
  const raw = text.replace(/\r\n?/g, "\n").split("\n");

  for (let i = 0; i < raw.length; i++) {
    const trimmed = raw[i].trim();
    if (!trimmed) continue;

    const m = trimmed.match(LINE_RE);
    if (!m) continue;

    lines.push({
      level: parseInt(m[1], 10),
      xref: m[2] ? m[2].trim() : null,
      tag: m[3].toUpperCase(),
      value: (m[4] ?? "").trim(),
      lineNum: i + 1,
    });
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Record extraction helpers
// ---------------------------------------------------------------------------

function extractRecordLines(lines: GedcomLine[], startIdx: number): GedcomLine[] {
  const startLevel = lines[startIdx].level;
  const result: GedcomLine[] = [lines[startIdx]];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].level <= startLevel) break;
    result.push(lines[i]);
  }
  return result;
}

function findSubTag(recordLines: GedcomLine[], parentLevel: number, parentTag: string, childTag: string): string | null {
  let inParent = false;
  for (const line of recordLines) {
    if (line.level === parentLevel + 1 && line.tag === parentTag) {
      inParent = true;
      continue;
    }
    if (inParent && line.level === parentLevel + 2 && line.tag === childTag) {
      return line.value || null;
    }
    if (inParent && line.level <= parentLevel + 1) {
      inParent = false;
    }
  }
  return null;
}

function findTag(recordLines: GedcomLine[], level: number, tag: string): string | null {
  for (const line of recordLines) {
    if (line.level === level && line.tag === tag) {
      return line.value || null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Date normalisation
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04",
  MAY: "05", JUN: "06", JUL: "07", AUG: "08",
  SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

/**
 * Attempt to normalise a GEDCOM date string into YYYY-MM-DD (or partial).
 * Returns the original string if it cannot be parsed so data is not lost.
 */
export function normalizeGedcomDate(raw: string | null): string | null {
  if (!raw) return null;

  // Strip common prefixes like ABT, BEF, AFT, CAL, EST, etc.
  const cleaned = raw.replace(/^(ABT|BEF|AFT|CAL|EST|FROM|TO|BET|AND|INT)\s+/gi, "").trim();

  // Try "DD MON YYYY"
  const full = cleaned.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/i);
  if (full) {
    const month = MONTH_MAP[full[2].toUpperCase()];
    if (month) {
      return `${full[3]}-${month}-${full[1].padStart(2, "0")}`;
    }
  }

  // Try "MON YYYY"
  const monthYear = cleaned.match(/^([A-Z]{3})\s+(\d{4})$/i);
  if (monthYear) {
    const month = MONTH_MAP[monthYear[1].toUpperCase()];
    if (month) {
      return `${monthYear[2]}-${month}`;
    }
  }

  // Try plain "YYYY"
  const yearOnly = cleaned.match(/^(\d{4})$/);
  if (yearOnly) {
    return yearOnly[1];
  }

  // Return as-is so the user can fix manually
  return cleaned || null;
}

// ---------------------------------------------------------------------------
// INDI parsing
// ---------------------------------------------------------------------------

function parseIndi(recordLines: GedcomLine[], errors: string[]): IndiRecord | null {
  const header = recordLines[0];
  const xref = header.xref;
  if (!xref) {
    errors.push(`Line ${header.lineNum}: INDI record without xref`);
    return null;
  }

  // Name — look for level-1 NAME tag
  let nameValue = "";
  let givenName = "";
  let surname = "";
  let maidenName: string | null = null;

  for (const line of recordLines) {
    if (line.level === 1 && line.tag === "NAME") {
      nameValue = line.value;
      break;
    }
  }

  // Parse "Given /Surname/" format
  const nameMatch = nameValue.match(/^([^/]*)\/?([^/]*)\/?(.*)$/);
  if (nameMatch) {
    givenName = nameMatch[1].trim();
    surname = nameMatch[2].trim();
  }

  // Also check for GIVN / SURN / _MARNM sub-tags
  for (const line of recordLines) {
    if (line.level === 2 && line.tag === "GIVN" && line.value) givenName = line.value;
    if (line.level === 2 && line.tag === "SURN" && line.value) surname = line.value;
    if (line.level === 2 && line.tag === "_MARNM" && line.value) maidenName = line.value;
  }

  if (!givenName && !surname) {
    givenName = nameValue || "Unknown";
  }

  // Sex
  const sexVal = findTag(recordLines, 1, "SEX");
  let sex: string | null = null;
  if (sexVal) {
    const s = sexVal.toUpperCase();
    if (s === "M") sex = "male";
    else if (s === "F") sex = "female";
    else sex = "other";
  }

  // Birth
  const birthDate = findSubTag(recordLines, 0, "BIRT", "DATE");
  const birthPlace = findSubTag(recordLines, 0, "BIRT", "PLAC");

  // Death
  const deathDate = findSubTag(recordLines, 0, "DEAT", "DATE");
  const deathPlace = findSubTag(recordLines, 0, "DEAT", "PLAC");

  // Check if deceased — presence of DEAT tag means deceased
  let isDeceased = false;
  for (const line of recordLines) {
    if (line.level === 1 && line.tag === "DEAT") {
      isDeceased = true;
      break;
    }
  }

  // Notes
  const notes: string[] = [];
  for (const line of recordLines) {
    if (line.level === 1 && line.tag === "NOTE" && line.value) {
      notes.push(line.value);
    }
  }

  return {
    xref,
    givenName: givenName || "Unknown",
    surname,
    maidenName,
    sex,
    birthDate: normalizeGedcomDate(birthDate),
    birthPlace: birthPlace,
    deathDate: normalizeGedcomDate(deathDate),
    deathPlace: deathPlace,
    isDeceased,
    notes,
  };
}

// ---------------------------------------------------------------------------
// FAM parsing
// ---------------------------------------------------------------------------

function parseFam(recordLines: GedcomLine[]): FamRecord | null {
  const header = recordLines[0];
  const xref = header.xref;
  if (!xref) return null;

  let husbXref: string | null = null;
  let wifeXref: string | null = null;
  const childXrefs: string[] = [];

  for (const line of recordLines) {
    if (line.level === 1) {
      if (line.tag === "HUSB" && line.value) husbXref = line.value;
      if (line.tag === "WIFE" && line.value) wifeXref = line.value;
      if (line.tag === "CHIL" && line.value) childXrefs.push(line.value);
    }
  }

  return { xref, husbXref, wifeXref, childXrefs };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseGedcom(text: string): GedcomParseResult {
  const errors: string[] = [];
  const lines = parseLines(text);

  if (lines.length === 0) {
    return { members: [], relationships: [], errors: ["File appears to be empty or not valid GEDCOM"] };
  }

  // Collect INDI and FAM records
  const indiRecords: IndiRecord[] = [];
  const famRecords: FamRecord[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.level === 0 && line.xref) {
      const recordLines = extractRecordLines(lines, i);
      const tag = line.value.toUpperCase() || line.tag.toUpperCase();

      if (tag === "INDI") {
        const indi = parseIndi(recordLines, errors);
        if (indi) indiRecords.push(indi);
      } else if (tag === "FAM") {
        const fam = parseFam(recordLines);
        if (fam) famRecords.push(fam);
      }
    }
  }

  if (indiRecords.length === 0) {
    errors.push("No individual records (INDI) found in file");
  }

  // Convert INDI to ParsedMember
  const members: ParsedMember[] = indiRecords.map((indi) => ({
    gedcom_id: indi.xref,
    first_name: indi.givenName,
    last_name: indi.surname || null,
    maiden_name: indi.maidenName,
    gender: (indi.sex as Gender) ?? null,
    date_of_birth: indi.birthDate,
    date_of_death: indi.deathDate,
    birth_place: indi.birthPlace,
    death_place: indi.deathPlace,
    bio: indi.notes.length > 0 ? indi.notes.join("\n") : null,
    is_deceased: indi.isDeceased,
  }));

  // Convert FAM to relationships
  const relationships: ParsedRelationship[] = [];
  const memberXrefs = new Set(indiRecords.map((i) => i.xref));

  for (const fam of famRecords) {
    // Spouse relationship
    if (fam.husbXref && fam.wifeXref && memberXrefs.has(fam.husbXref) && memberXrefs.has(fam.wifeXref)) {
      relationships.push({
        from_gedcom_id: fam.husbXref,
        to_gedcom_id: fam.wifeXref,
        relationship_type: "spouse",
      });
    }

    // Parent-child relationships
    for (const childXref of fam.childXrefs) {
      if (!memberXrefs.has(childXref)) {
        errors.push(`Family ${fam.xref}: child ${childXref} not found in individuals`);
        continue;
      }

      if (fam.husbXref && memberXrefs.has(fam.husbXref)) {
        relationships.push({
          from_gedcom_id: fam.husbXref,
          to_gedcom_id: childXref,
          relationship_type: "parent_child",
        });
      }

      if (fam.wifeXref && memberXrefs.has(fam.wifeXref)) {
        relationships.push({
          from_gedcom_id: fam.wifeXref,
          to_gedcom_id: childXref,
          relationship_type: "parent_child",
        });
      }
    }
  }

  // Parse custom extended relationship tags from INDI records
  const customTagMap: Record<string, RelationshipType> = {
    "_SIBL": "sibling",
    "_STEP": "step_parent",
    "_STEPC": "step_child",
    "_GUARD": "guardian",
    "_INLAW": "in_law",
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.level === 1 && line.tag in customTagMap && line.value) {
      // Find the parent INDI record xref
      let ownerXref: string | null = null;
      for (let j = i - 1; j >= 0; j--) {
        if (lines[j].level === 0 && lines[j].xref) {
          ownerXref = lines[j].xref;
          break;
        }
      }
      if (ownerXref && memberXrefs.has(ownerXref) && memberXrefs.has(line.value)) {
        relationships.push({
          from_gedcom_id: ownerXref,
          to_gedcom_id: line.value,
          relationship_type: customTagMap[line.tag],
        });
      }
    }
  }

  return { members, relationships, errors };
}
