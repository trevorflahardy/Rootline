import { describe, it, expect } from "vitest";
import {
  GraphValidationError,
  detectDuplicateRelationship,
  findOrphanNodes,
  validateTreeDepth,
  findAffectedRelationships,
} from "@/lib/validators/graph";

describe("detectDuplicateRelationship", () => {
  it("throws when same type A->B already exists", () => {
    const existing = [
      {
        from_member_id: "a",
        to_member_id: "b",
        relationship_type: "parent_child",
      },
    ];

    expect(() =>
      detectDuplicateRelationship("a", "b", "parent_child", existing)
    ).toThrow(GraphValidationError);
  });

  it("throws for symmetric type when reverse direction exists (spouse B->A exists, adding A->B)", () => {
    const existing = [
      {
        from_member_id: "b",
        to_member_id: "a",
        relationship_type: "spouse",
      },
    ];

    expect(() =>
      detectDuplicateRelationship("a", "b", "spouse", existing)
    ).toThrow(GraphValidationError);
  });

  it("allows different type between same members", () => {
    const existing = [
      {
        from_member_id: "a",
        to_member_id: "b",
        relationship_type: "parent_child",
      },
    ];

    expect(() =>
      detectDuplicateRelationship("a", "b", "spouse", existing)
    ).not.toThrow();
  });

  it("allows directional type in reverse direction (parent_child A->B exists, adding B->A)", () => {
    const existing = [
      {
        from_member_id: "a",
        to_member_id: "b",
        relationship_type: "parent_child",
      },
    ];

    expect(() =>
      detectDuplicateRelationship("b", "a", "parent_child", existing)
    ).not.toThrow();
  });

  it("allows relationship when existing array is empty", () => {
    expect(() =>
      detectDuplicateRelationship("a", "b", "spouse", [])
    ).not.toThrow();
  });
});

describe("findOrphanNodes", () => {
  it("returns member with zero relationships as orphan", () => {
    const result = findOrphanNodes(
      ["a", "b", "c"],
      [{ from_member_id: "a", to_member_id: "b" }]
    );

    expect(result).toEqual(["c"]);
  });

  it("does not include member appearing in from_member_id", () => {
    const result = findOrphanNodes(
      ["a", "b"],
      [{ from_member_id: "a", to_member_id: "b" }]
    );

    expect(result).not.toContain("a");
  });

  it("does not include member appearing in to_member_id", () => {
    const result = findOrphanNodes(
      ["a", "b"],
      [{ from_member_id: "a", to_member_id: "b" }]
    );

    expect(result).not.toContain("b");
  });

  it("returns empty array when all members have relationships", () => {
    const result = findOrphanNodes(
      ["a", "b"],
      [{ from_member_id: "a", to_member_id: "b" }]
    );

    expect(result).toEqual([]);
  });

  it("returns all members as orphans when relationships array is empty", () => {
    const result = findOrphanNodes(["a", "b", "c"], []);

    expect(result).toEqual(["a", "b", "c"]);
  });
});

describe("validateTreeDepth", () => {
  it("returns correct depth for a linear chain of 5", () => {
    const relationships = [
      { from_member_id: "1", to_member_id: "2", relationship_type: "parent_child" },
      { from_member_id: "2", to_member_id: "3", relationship_type: "parent_child" },
      { from_member_id: "3", to_member_id: "4", relationship_type: "parent_child" },
      { from_member_id: "4", to_member_id: "5", relationship_type: "parent_child" },
    ];

    expect(validateTreeDepth(relationships)).toBe(5);
  });

  it("throws when chain of 51 exceeds default max of 50", () => {
    const relationships = Array.from({ length: 50 }, (_, i) => ({
      from_member_id: String(i),
      to_member_id: String(i + 1),
      relationship_type: "parent_child",
    }));

    expect(() => validateTreeDepth(relationships)).toThrow(GraphValidationError);
    expect(() => validateTreeDepth(relationships)).toThrow(
      "Tree depth 51 exceeds maximum allowed depth of 50"
    );
  });

  it("returns 51 without throwing when maxDepth is 100", () => {
    const relationships = Array.from({ length: 50 }, (_, i) => ({
      from_member_id: String(i),
      to_member_id: String(i + 1),
      relationship_type: "parent_child",
    }));

    expect(validateTreeDepth(relationships, 100)).toBe(51);
  });

  it("returns 0 when there are no parent_child relationships", () => {
    const relationships = [
      { from_member_id: "a", to_member_id: "b", relationship_type: "spouse" },
    ];

    expect(validateTreeDepth(relationships)).toBe(0);
  });

  it("handles 1000-node chain without stack overflow (performance)", () => {
    const relationships = Array.from({ length: 999 }, (_, i) => ({
      from_member_id: String(i),
      to_member_id: String(i + 1),
      relationship_type: "parent_child",
    }));

    expect(validateTreeDepth(relationships, 1001)).toBe(1000);
  });
});

describe("findAffectedRelationships", () => {
  it("returns all relationship IDs for a member with 3 relationships", () => {
    const relationships = [
      { id: "r1", from_member_id: "a", to_member_id: "b" },
      { id: "r2", from_member_id: "a", to_member_id: "c" },
      { id: "r3", from_member_id: "d", to_member_id: "a" },
      { id: "r4", from_member_id: "b", to_member_id: "c" },
    ];

    const result = findAffectedRelationships("a", relationships);
    expect(result).toEqual(["r1", "r2", "r3"]);
  });

  it("returns empty array for a member with 0 relationships", () => {
    const relationships = [
      { id: "r1", from_member_id: "b", to_member_id: "c" },
    ];

    const result = findAffectedRelationships("a", relationships);
    expect(result).toEqual([]);
  });

  it("returns all matching IDs when member appears as both from and to", () => {
    const relationships = [
      { id: "r1", from_member_id: "a", to_member_id: "b" },
      { id: "r2", from_member_id: "b", to_member_id: "a" },
    ];

    const result = findAffectedRelationships("a", relationships);
    expect(result).toEqual(["r1", "r2"]);
  });
});
