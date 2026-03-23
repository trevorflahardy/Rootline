import { describe, it, expect } from "vitest";
import { parseGedcom, normalizeGedcomDate } from "../gedcom-parser";

describe("normalizeGedcomDate", () => {
  it("converts DD MON YYYY to YYYY-MM-DD", () => {
    expect(normalizeGedcomDate("15 MAR 1985")).toBe("1985-03-15");
  });

  it("converts MON YYYY to YYYY-MM", () => {
    expect(normalizeGedcomDate("JUN 2000")).toBe("2000-06");
  });

  it("passes through YYYY as-is", () => {
    expect(normalizeGedcomDate("1942")).toBe("1942");
  });

  it("strips ABT prefix", () => {
    expect(normalizeGedcomDate("ABT 1900")).toBe("1900");
  });

  it("strips BEF prefix and parses date", () => {
    expect(normalizeGedcomDate("BEF 5 JAN 1800")).toBe("1800-01-05");
  });

  it("returns null for null input", () => {
    expect(normalizeGedcomDate(null)).toBeNull();
  });

  it("returns cleaned string for unrecognised format", () => {
    expect(normalizeGedcomDate("SOME RANDOM DATE")).toBe("SOME RANDOM DATE");
  });
});

describe("parseGedcom", () => {
  const MINIMAL_GEDCOM = `
0 HEAD
1 SOUR TEST
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR UTF-8
0 @I1@ INDI
1 NAME John /Smith/
2 GIVN John
2 SURN Smith
1 SEX M
1 BIRT
2 DATE 15 MAR 1985
2 PLAC New York
0 @I2@ INDI
1 NAME Jane /Doe/
1 SEX F
1 BIRT
2 DATE 20 JUN 1987
0 @I3@ INDI
1 NAME Jimmy /Smith/
1 SEX M
1 BIRT
2 DATE 1 JAN 2010
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
0 TRLR
`.trim();

  it("parses individuals from GEDCOM text", () => {
    const result = parseGedcom(MINIMAL_GEDCOM);
    expect(result.members).toHaveLength(3);

    const john = result.members.find((m) => m.first_name === "John");
    expect(john).toBeDefined();
    expect(john!.last_name).toBe("Smith");
    expect(john!.gender).toBe("male");
    expect(john!.date_of_birth).toBe("1985-03-15");
    expect(john!.birth_place).toBe("New York");
  });

  it("parses family relationships", () => {
    const result = parseGedcom(MINIMAL_GEDCOM);
    // 1 spouse + 2 parent-child = 3 relationships
    expect(result.relationships).toHaveLength(3);

    const spouseRel = result.relationships.find((r) => r.relationship_type === "spouse");
    expect(spouseRel).toBeDefined();
    expect(spouseRel!.from_gedcom_id).toBe("@I1@");
    expect(spouseRel!.to_gedcom_id).toBe("@I2@");

    const parentChildRels = result.relationships.filter((r) => r.relationship_type === "parent_child");
    expect(parentChildRels).toHaveLength(2);
  });

  it("reports errors but still parses valid data", () => {
    const gedcom = `
0 HEAD
0 @I1@ INDI
1 NAME Alice /Wonder/
1 SEX F
0 @F1@ FAM
1 HUSB @I1@
1 CHIL @I99@
0 TRLR
`.trim();

    const result = parseGedcom(gedcom);
    expect(result.members).toHaveLength(1);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("@I99@");
  });

  it("returns error for empty input", () => {
    const result = parseGedcom("");
    expect(result.members).toHaveLength(0);
    expect(result.errors).toContain("File appears to be empty or not valid GEDCOM");
  });

  it("handles deceased individuals with DEAT tag", () => {
    const gedcom = `
0 HEAD
0 @I1@ INDI
1 NAME Bob /Builder/
1 SEX M
1 DEAT
2 DATE 10 NOV 2020
2 PLAC London
0 TRLR
`.trim();

    const result = parseGedcom(gedcom);
    expect(result.members).toHaveLength(1);
    expect(result.members[0].is_deceased).toBe(true);
    expect(result.members[0].date_of_death).toBe("2020-11-10");
    expect(result.members[0].death_place).toBe("London");
  });

  it("handles notes on individuals", () => {
    const gedcom = `
0 HEAD
0 @I1@ INDI
1 NAME Noted /Person/
1 SEX F
1 NOTE This person has a note
0 TRLR
`.trim();

    const result = parseGedcom(gedcom);
    expect(result.members[0].bio).toBe("This person has a note");
  });

  it("handles maiden name via _MARNM tag", () => {
    const gedcom = `
0 HEAD
0 @I1@ INDI
1 NAME Mary /Johnson/
2 GIVN Mary
2 SURN Johnson
2 _MARNM Williams
1 SEX F
0 TRLR
`.trim();

    const result = parseGedcom(gedcom);
    expect(result.members[0].maiden_name).toBe("Williams");
  });

  it("handles multiple families with shared and unshared children", () => {
    const gedcom = `
0 HEAD
0 @I1@ INDI
1 NAME Dad /One/
1 SEX M
0 @I2@ INDI
1 NAME Mom /One/
1 SEX F
0 @I3@ INDI
1 NAME Mom /Two/
1 SEX F
0 @I4@ INDI
1 NAME Child /One/
1 SEX M
0 @I5@ INDI
1 NAME Child /Two/
1 SEX F
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I4@
0 @F2@ FAM
1 HUSB @I1@
1 WIFE @I3@
1 CHIL @I5@
0 TRLR
`.trim();

    const result = parseGedcom(gedcom);
    expect(result.members).toHaveLength(5);
    // 2 spouse + 2 parent-child per family = 6
    expect(result.relationships).toHaveLength(6);
  });
});
