import { describe, it, expect } from "vitest";
import { exportGedcom } from "../gedcom-exporter";
import type { TreeMember, Relationship } from "@/types";

function makeMember(
  overrides: Partial<TreeMember> & { id: string; first_name: string }
): TreeMember {
  return {
    tree_id: "tree-1",
    last_name: null,
    maiden_name: null,
    gender: null,
    date_of_birth: null,
    date_of_death: null,
    birth_place: null,
    death_place: null,
    bio: null,
    avatar_url: null,
    is_deceased: false,
    position_x: null,
    position_y: null,
    birth_year: null,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    created_by: null,
    ...overrides,
  };
}

function makeRel(
  overrides: Partial<Relationship> & {
    id: string;
    from_member_id: string;
    to_member_id: string;
    relationship_type: Relationship["relationship_type"];
  }
): Relationship {
  return {
    tree_id: "tree-1",
    start_date: null,
    end_date: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("exportGedcom", () => {
  it("generates valid GEDCOM structure with HEAD and TRLR", () => {
    const members = [makeMember({ id: "1", first_name: "John", last_name: "Smith" })];
    const result = exportGedcom(members, []);

    expect(result).toContain("0 HEAD");
    expect(result).toContain("0 TRLR");
    expect(result).toContain("1 SOUR RootLine");
    expect(result).toContain("2 VERS 5.5.1");
    expect(result).toContain("1 CHAR UTF-8");
  });

  it("includes tree name in HEAD NOTE", () => {
    const members = [makeMember({ id: "1", first_name: "John" })];
    const result = exportGedcom(members, [], "My Family");

    expect(result).toContain("1 NOTE My Family");
  });

  it("exports individual records with names", () => {
    const members = [makeMember({ id: "1", first_name: "John", last_name: "Smith" })];
    const result = exportGedcom(members, []);

    expect(result).toContain("@I1@ INDI");
    expect(result).toContain("1 NAME John /Smith/");
    expect(result).toContain("2 GIVN John");
    expect(result).toContain("2 SURN Smith");
  });

  it("exports sex field", () => {
    const members = [
      makeMember({ id: "1", first_name: "John", gender: "male" }),
      makeMember({ id: "2", first_name: "Jane", gender: "female" }),
    ];
    const result = exportGedcom(members, []);

    expect(result).toContain("1 SEX M");
    expect(result).toContain("1 SEX F");
  });

  it("exports birth and death events", () => {
    const members = [
      makeMember({
        id: "1",
        first_name: "John",
        date_of_birth: "1985-03-15",
        birth_place: "New York",
        date_of_death: "2020-11-10",
        death_place: "London",
        is_deceased: true,
      }),
    ];
    const result = exportGedcom(members, []);

    expect(result).toContain("1 BIRT");
    expect(result).toContain("2 DATE 15 MAR 1985");
    expect(result).toContain("2 PLAC New York");
    expect(result).toContain("1 DEAT");
    expect(result).toContain("2 DATE 10 NOV 2020");
    expect(result).toContain("2 PLAC London");
  });

  it("exports deceased without a date", () => {
    const members = [makeMember({ id: "1", first_name: "John", is_deceased: true })];
    const result = exportGedcom(members, []);
    expect(result).toContain("1 DEAT");
  });

  it("exports family records for spouse relationships", () => {
    const members = [
      makeMember({ id: "1", first_name: "John", gender: "male" }),
      makeMember({ id: "2", first_name: "Jane", gender: "female" }),
    ];
    const relationships = [
      makeRel({ id: "r1", from_member_id: "1", to_member_id: "2", relationship_type: "spouse" }),
    ];
    const result = exportGedcom(members, relationships);

    expect(result).toContain("@F1@ FAM");
    expect(result).toContain("1 HUSB @I1@");
    expect(result).toContain("1 WIFE @I2@");
  });

  it("exports parent-child relationships within families", () => {
    const members = [
      makeMember({ id: "1", first_name: "Dad", gender: "male" }),
      makeMember({ id: "2", first_name: "Mom", gender: "female" }),
      makeMember({ id: "3", first_name: "Kid", gender: "male" }),
    ];
    const relationships = [
      makeRel({ id: "r1", from_member_id: "1", to_member_id: "2", relationship_type: "spouse" }),
      makeRel({
        id: "r2",
        from_member_id: "1",
        to_member_id: "3",
        relationship_type: "parent_child",
      }),
      makeRel({
        id: "r3",
        from_member_id: "2",
        to_member_id: "3",
        relationship_type: "parent_child",
      }),
    ];
    const result = exportGedcom(members, relationships);

    expect(result).toContain("1 CHIL @I3@");
    // The child should have FAMC reference
    expect(result).toContain("1 FAMC @F1@");
  });

  it("exports single parent families", () => {
    const members = [
      makeMember({ id: "1", first_name: "SingleMom", gender: "female" }),
      makeMember({ id: "2", first_name: "Child", gender: "male" }),
    ];
    const relationships = [
      makeRel({
        id: "r1",
        from_member_id: "1",
        to_member_id: "2",
        relationship_type: "parent_child",
      }),
    ];
    const result = exportGedcom(members, relationships);

    expect(result).toContain("@F1@ FAM");
    expect(result).toContain("1 CHIL @I2@");
  });

  it("exports bio as NOTE with CONT for multi-line", () => {
    const members = [makeMember({ id: "1", first_name: "John", bio: "Line one\nLine two" })];
    const result = exportGedcom(members, []);

    expect(result).toContain("1 NOTE Line one");
    expect(result).toContain("2 CONT Line two");
  });

  it("exports maiden name as _MARNM", () => {
    const members = [makeMember({ id: "1", first_name: "Jane", maiden_name: "Doe" })];
    const result = exportGedcom(members, []);

    expect(result).toContain("2 _MARNM Doe");
  });

  it("handles empty member list", () => {
    const result = exportGedcom([], []);

    expect(result).toContain("0 HEAD");
    expect(result).toContain("0 TRLR");
  });
});
