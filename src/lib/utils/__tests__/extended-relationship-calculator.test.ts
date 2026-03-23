import { describe, it, expect } from "vitest";
import { calculateRelationship } from "../relationship-calculator";
import { findPath } from "../path-finder";
import type { PathStep } from "../path-finder";
import type { Relationship, RelationshipType } from "@/types";

/**
 * Helper to build a PathStep array from a compact description.
 * The first entry is always the start node with null direction.
 */
function buildPath(
  steps: Array<{
    memberId: string;
    relId: string;
    type: RelationshipType;
    direction: "up" | "down" | "spouse";
  }>
): PathStep[] {
  if (steps.length === 0) return [];
  const path: PathStep[] = [
    {
      memberId: "start",
      relationshipId: null,
      relationshipType: null,
      direction: null,
    },
  ];
  for (const s of steps) {
    path.push({
      memberId: s.memberId,
      relationshipId: s.relId,
      relationshipType: s.type,
      direction: s.direction,
    });
  }
  return path;
}

function makeRel(
  id: string,
  from: string,
  to: string,
  type: RelationshipType
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

describe("Extended Relationship Calculator", () => {
  it("direct sibling returns 'Sibling'", () => {
    const path = buildPath([
      { memberId: "sibling1", relId: "r1", type: "sibling", direction: "spouse" },
    ]);
    expect(calculateRelationship(path)).toBe("Sibling");
  });

  it("step-parent (going up) returns 'Step-Parent'", () => {
    const path = buildPath([
      { memberId: "stepParent1", relId: "r1", type: "step_parent", direction: "up" },
    ]);
    expect(calculateRelationship(path)).toBe("Step-Parent");
  });

  it("step-parent (going down) returns 'Step-Child'", () => {
    const path = buildPath([
      { memberId: "stepChild1", relId: "r1", type: "step_parent", direction: "down" },
    ]);
    expect(calculateRelationship(path)).toBe("Step-Child");
  });

  it("step_child type (going up) returns 'Step-Child'", () => {
    const path = buildPath([
      { memberId: "sc1", relId: "r1", type: "step_child", direction: "up" },
    ]);
    expect(calculateRelationship(path)).toBe("Step-Child");
  });

  it("step_child type (going down) returns 'Step-Parent'", () => {
    const path = buildPath([
      { memberId: "sc1", relId: "r1", type: "step_child", direction: "down" },
    ]);
    expect(calculateRelationship(path)).toBe("Step-Parent");
  });

  it("guardian (going up) returns 'Guardian'", () => {
    const path = buildPath([
      { memberId: "g1", relId: "r1", type: "guardian", direction: "up" },
    ]);
    expect(calculateRelationship(path)).toBe("Guardian");
  });

  it("guardian (going down, ward perspective) returns 'Ward'", () => {
    const path = buildPath([
      { memberId: "ward1", relId: "r1", type: "guardian", direction: "down" },
    ]);
    expect(calculateRelationship(path)).toBe("Ward");
  });

  it("in-law returns 'In-Law'", () => {
    const path = buildPath([
      { memberId: "inlaw1", relId: "r1", type: "in_law", direction: "spouse" },
    ]);
    expect(calculateRelationship(path)).toBe("In-Law");
  });

  it("path: parent_child up + parent_child down = Sibling", () => {
    // Go up to parent, then down to sibling
    const path = buildPath([
      { memberId: "parent", relId: "r1", type: "parent_child", direction: "up" },
      { memberId: "sibling", relId: "r2", type: "parent_child", direction: "down" },
    ]);
    expect(calculateRelationship(path)).toBe("Sibling");
  });

  it("path: parent_child up + parent_child up + parent_child down = Aunt/Uncle", () => {
    // Go 2 up, 1 down
    const path = buildPath([
      { memberId: "parent", relId: "r1", type: "parent_child", direction: "up" },
      { memberId: "grandparent", relId: "r2", type: "parent_child", direction: "up" },
      { memberId: "uncle", relId: "r3", type: "parent_child", direction: "down" },
    ]);
    expect(calculateRelationship(path)).toBe("Aunt/Uncle");
  });

  it("path with step_parent + parent_child combination counts directions", () => {
    // step_parent going up (counted as "up"), then parent_child going down
    const path = buildPath([
      { memberId: "stepParent", relId: "r1", type: "step_parent", direction: "up" },
      { memberId: "stepSibling", relId: "r2", type: "parent_child", direction: "down" },
    ]);
    // 1 up, 1 down = Sibling
    expect(calculateRelationship(path)).toBe("Sibling");
  });

  it("path with in_law + spouse combination", () => {
    // in_law is direction "spouse", then spouse is also direction "spouse"
    // 0 ups, 0 downs, hasSpouse = true → "Spouse"
    const path = buildPath([
      { memberId: "inlaw", relId: "r1", type: "in_law", direction: "spouse" },
      { memberId: "spouse", relId: "r2", type: "spouse", direction: "spouse" },
    ]);
    expect(calculateRelationship(path)).toBe("Spouse");
  });

  it("path with guardian + parent_child combination", () => {
    // guardian going up (up), then parent_child going down (down)
    // 1 up, 1 down = Sibling
    const path = buildPath([
      { memberId: "guardian", relId: "r1", type: "guardian", direction: "up" },
      { memberId: "guardianChild", relId: "r2", type: "parent_child", direction: "down" },
    ]);
    expect(calculateRelationship(path)).toBe("Sibling");
  });

  it("multiple extended types in single path", () => {
    // step_parent up, sibling across, guardian down
    // ups=1, downs=1, hasSpouse=true (sibling direction is "spouse")
    const path = buildPath([
      { memberId: "m1", relId: "r1", type: "step_parent", direction: "up" },
      { memberId: "m2", relId: "r2", type: "sibling", direction: "spouse" },
      { memberId: "m3", relId: "r3", type: "guardian", direction: "down" },
    ]);
    // 1 up, 1 down, hasSpouse → "1st Cousin (by marriage)" per the function logic
    // Actually: ups=1, downs=1, hasSpouse=true → cousinName = getCousinName(1,1)
    // minGen=1, cousinNumber=0 → "Aunt/Uncle" or "Niece/Nephew" but removed=0 so it's just "Sibling"
    // Wait: getCousinName(1,1) → minGen=1, cousinNumber=0, removed=0
    // cousinNumber===0 → ups>downs? no ups===downs → "Niece/Nephew" with removed=-1? No, removed = abs(1-1) = 0
    // cousinNumber===0 and removed=0: ups(1) > downs(1) is false, so "Niece/Nephew" + (0>1 false) = "Niece/Nephew"
    // But hasSpouse → goes to the "has spouse" branch: ups=1, downs=1 → cousinName + "(by marriage)"
    // Actually let me re-read: the function first checks specific patterns (ups===1,downs===1,!hasSpouse → Sibling)
    // Since hasSpouse=true, it skips all the non-spouse patterns and goes to the hasSpouse section
    // ups=1,downs=1 → falls through to "In-law through cousin path"
    // getCousinName(1,1) = minGen=1, cousinNumber=0, removed=0 → ups>downs is false → "Niece/Nephew"
    // Returns "Niece/Nephew (by marriage)"
    const result = calculateRelationship(path);
    expect(result).toBe("Niece/Nephew (by marriage)");
  });

  it("self-referencing (same start and end) returns 'Self'", () => {
    // findPath with same start and end returns a single-step path
    const relationships = [
      makeRel("r1", "A", "B", "parent_child"),
    ];
    const path = findPath(relationships, "A", "A");
    expect(path).not.toBeNull();
    expect(calculateRelationship(path!)).toBe("Self");
  });

  it("single-step paths for each extended type", () => {
    const singleStepTests: Array<{
      type: RelationshipType;
      direction: "up" | "down" | "spouse";
      expected: string;
    }> = [
      { type: "sibling", direction: "spouse", expected: "Sibling" },
      { type: "in_law", direction: "spouse", expected: "In-Law" },
      { type: "step_parent", direction: "up", expected: "Step-Parent" },
      { type: "step_parent", direction: "down", expected: "Step-Child" },
      { type: "step_child", direction: "up", expected: "Step-Child" },
      { type: "step_child", direction: "down", expected: "Step-Parent" },
      { type: "guardian", direction: "up", expected: "Guardian" },
      { type: "guardian", direction: "down", expected: "Ward" },
      { type: "spouse", direction: "spouse", expected: "Spouse" },
      { type: "divorced", direction: "spouse", expected: "Spouse" },
      { type: "parent_child", direction: "down", expected: "Child" },
      { type: "parent_child", direction: "up", expected: "Parent" },
      { type: "adopted", direction: "down", expected: "Child" },
      { type: "adopted", direction: "up", expected: "Parent" },
    ];

    for (const { type, direction, expected } of singleStepTests) {
      const path = buildPath([
        { memberId: "target", relId: "r1", type, direction },
      ]);
      const result = calculateRelationship(path);
      expect(result).toBe(expected);
    }
  });
});
