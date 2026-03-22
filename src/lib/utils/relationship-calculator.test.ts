import { describe, it, expect } from "vitest";
import { calculateRelationship } from "./relationship-calculator";
import type { PathStep } from "./path-finder";

function makePath(directions: Array<"up" | "down" | "spouse" | null>): PathStep[] {
  return directions.map((dir, i) => ({
    memberId: `member-${i}`,
    relationshipId: i === 0 ? null : `rel-${i}`,
    relationshipType: dir === "spouse" ? "spouse" : dir ? "parent_child" : null,
    direction: dir,
  }));
}

describe("calculateRelationship", () => {
  it("returns Self for same person", () => {
    expect(calculateRelationship(makePath([null]))).toBe("Self");
  });

  it("identifies Parent (1 up)", () => {
    expect(calculateRelationship(makePath([null, "up"]))).toBe("Parent");
  });

  it("identifies Child (1 down)", () => {
    expect(calculateRelationship(makePath([null, "down"]))).toBe("Child");
  });

  it("identifies Spouse", () => {
    expect(calculateRelationship(makePath([null, "spouse"]))).toBe("Spouse");
  });

  it("identifies Grandparent (2 up)", () => {
    expect(calculateRelationship(makePath([null, "up", "up"]))).toBe("Grandparent");
  });

  it("identifies Grandchild (2 down)", () => {
    expect(calculateRelationship(makePath([null, "down", "down"]))).toBe("Grandchild");
  });

  it("identifies Great-Grandparent (3 up)", () => {
    expect(calculateRelationship(makePath([null, "up", "up", "up"]))).toBe("Great-Grandparent");
  });

  it("identifies Sibling (1 up, 1 down)", () => {
    expect(calculateRelationship(makePath([null, "up", "down"]))).toBe("Sibling");
  });

  it("identifies Aunt/Uncle (2 up, 1 down)", () => {
    expect(calculateRelationship(makePath([null, "up", "up", "down"]))).toBe("Aunt/Uncle");
  });

  it("identifies Niece/Nephew (1 up, 2 down)", () => {
    expect(calculateRelationship(makePath([null, "up", "down", "down"]))).toBe("Niece/Nephew");
  });

  it("identifies 1st Cousin (2 up, 2 down)", () => {
    expect(calculateRelationship(makePath([null, "up", "up", "down", "down"]))).toBe("1st Cousin");
  });

  it("identifies 1st Cousin, Once Removed (2 up, 3 down)", () => {
    const result = calculateRelationship(makePath([null, "up", "up", "down", "down", "down"]));
    expect(result).toBe("1st Cousin, Once Removed");
  });

  it("identifies 2nd Cousin (3 up, 3 down)", () => {
    const result = calculateRelationship(
      makePath([null, "up", "up", "up", "down", "down", "down"])
    );
    expect(result).toBe("2nd Cousin");
  });

  it("identifies Spouse's Parent", () => {
    expect(calculateRelationship(makePath([null, "spouse", "up"]))).toBe("Spouse's Parent");
  });
});
