import { describe, it, expect } from "vitest";
import { parseGedcom } from "../gedcom-parser";
import { exportGedcom } from "../gedcom-exporter";
import type { TreeMember, Relationship } from "@/types";

function makeMember(id: string, firstName: string, lastName?: string): TreeMember {
  return {
    id,
    tree_id: "tree-1",
    first_name: firstName,
    last_name: lastName ?? null,
    maiden_name: null,
    gender: null,
    date_of_birth: null,
    date_of_death: null,
    birth_place: null,
    death_place: null,
    bio: null,
    avatar_url: null,
    is_deceased: false,
    birth_year: null,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    position_x: null,
    position_y: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    created_by: null,
  };
}

function makeRel(
  id: string,
  from: string,
  to: string,
  type: Relationship["relationship_type"]
): Relationship {
  return {
    id,
    tree_id: "tree-1",
    from_member_id: from,
    to_member_id: to,
    relationship_type: type,
    start_date: null,
    end_date: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("GEDCOM extended relationship export", () => {
  it("exports sibling relationships using _SIBL custom tag", () => {
    const members = [makeMember("a", "Alice"), makeMember("b", "Bob")];
    const rels = [makeRel("r1", "a", "b", "sibling")];
    const gedcom = exportGedcom(members, rels);
    expect(gedcom).toContain("_SIBL");
    expect(gedcom).toContain("Custom tags:");
  });

  it("exports step_parent relationships using _STEP custom tag", () => {
    const members = [makeMember("a", "StepDad"), makeMember("b", "Child")];
    const rels = [makeRel("r1", "a", "b", "step_parent")];
    const gedcom = exportGedcom(members, rels);
    expect(gedcom).toContain("_STEP");
  });

  it("exports guardian relationships using _GUARD custom tag", () => {
    const members = [makeMember("a", "Guardian"), makeMember("b", "Ward")];
    const rels = [makeRel("r1", "a", "b", "guardian")];
    const gedcom = exportGedcom(members, rels);
    expect(gedcom).toContain("_GUARD");
  });

  it("exports in_law relationships using _INLAW custom tag", () => {
    const members = [makeMember("a", "Person"), makeMember("b", "InLaw")];
    const rels = [makeRel("r1", "a", "b", "in_law")];
    const gedcom = exportGedcom(members, rels);
    expect(gedcom).toContain("_INLAW");
  });

  it("exports step_child relationships using _STEPC custom tag", () => {
    const members = [makeMember("a", "Child"), makeMember("b", "StepParent")];
    const rels = [makeRel("r1", "a", "b", "step_child")];
    const gedcom = exportGedcom(members, rels);
    expect(gedcom).toContain("_STEPC");
  });
});

describe("GEDCOM extended relationship import", () => {
  it("parses _SIBL custom tag as sibling relationship", () => {
    const gedcom = [
      "0 HEAD",
      "1 GEDC",
      "2 VERS 5.5.1",
      "0 @I1@ INDI",
      "1 NAME Alice //",
      "1 _SIBL @I2@",
      "0 @I2@ INDI",
      "1 NAME Bob //",
      "0 TRLR",
    ].join("\n");

    const result = parseGedcom(gedcom);
    expect(result.errors).toHaveLength(0);
    const siblingRels = result.relationships.filter((r) => r.relationship_type === "sibling");
    expect(siblingRels).toHaveLength(1);
    expect(siblingRels[0].from_gedcom_id).toBe("@I1@");
    expect(siblingRels[0].to_gedcom_id).toBe("@I2@");
  });

  it("parses _GUARD custom tag as guardian relationship", () => {
    const gedcom = [
      "0 HEAD",
      "1 GEDC",
      "2 VERS 5.5.1",
      "0 @I1@ INDI",
      "1 NAME Guardian //",
      "1 _GUARD @I2@",
      "0 @I2@ INDI",
      "1 NAME Ward //",
      "0 TRLR",
    ].join("\n");

    const result = parseGedcom(gedcom);
    const guardianRels = result.relationships.filter((r) => r.relationship_type === "guardian");
    expect(guardianRels).toHaveLength(1);
  });

  it("parses _INLAW custom tag as in_law relationship", () => {
    const gedcom = [
      "0 HEAD",
      "1 GEDC",
      "2 VERS 5.5.1",
      "0 @I1@ INDI",
      "1 NAME Person //",
      "1 _INLAW @I2@",
      "0 @I2@ INDI",
      "1 NAME InLaw //",
      "0 TRLR",
    ].join("\n");

    const result = parseGedcom(gedcom);
    const inlawRels = result.relationships.filter((r) => r.relationship_type === "in_law");
    expect(inlawRels).toHaveLength(1);
  });
});

describe("GEDCOM extended relationship round-trip", () => {
  it("round-trips sibling relationship through export and re-import", () => {
    const members = [makeMember("a", "Alice", "Smith"), makeMember("b", "Bob", "Smith")];
    const rels = [makeRel("r1", "a", "b", "sibling")];

    const exported = exportGedcom(members, rels);
    const reimported = parseGedcom(exported);

    expect(reimported.errors).toHaveLength(0);
    const siblingRels = reimported.relationships.filter((r) => r.relationship_type === "sibling");
    expect(siblingRels).toHaveLength(1);
  });

  it("round-trips multiple extended relationship types", () => {
    const members = [
      makeMember("a", "Alice"),
      makeMember("b", "Bob"),
      makeMember("c", "Charlie"),
      makeMember("d", "Diana"),
    ];
    const rels = [
      makeRel("r1", "a", "b", "sibling"),
      makeRel("r2", "a", "c", "guardian"),
      makeRel("r3", "b", "d", "in_law"),
    ];

    const exported = exportGedcom(members, rels);
    const reimported = parseGedcom(exported);

    expect(reimported.errors).toHaveLength(0);
    expect(reimported.relationships.filter((r) => r.relationship_type === "sibling")).toHaveLength(
      1
    );
    expect(reimported.relationships.filter((r) => r.relationship_type === "guardian")).toHaveLength(
      1
    );
    expect(reimported.relationships.filter((r) => r.relationship_type === "in_law")).toHaveLength(
      1
    );
  });

  it("round-trips step_parent and step_child relationships", () => {
    const members = [makeMember("a", "StepParent"), makeMember("b", "Child")];
    const rels = [makeRel("r1", "a", "b", "step_parent")];

    const exported = exportGedcom(members, rels);
    const reimported = parseGedcom(exported);

    expect(reimported.errors).toHaveLength(0);
    const stepRels = reimported.relationships.filter((r) => r.relationship_type === "step_parent");
    expect(stepRels).toHaveLength(1);
  });
});
