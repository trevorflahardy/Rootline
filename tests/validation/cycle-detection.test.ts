import { describe, it, expect } from "vitest";
import {
  CycleDetectionError,
  detectCycle,
} from "../../src/lib/validators/cycle-detection";

function rel(from: string, to: string, type = "parent_child") {
  return { from_member_id: from, to_member_id: to, relationship_type: type };
}

describe("detectCycle", () => {
  it("should throw on direct cycle: A→B exists, adding B→A", () => {
    const existing = [rel("A", "B")];
    expect(() => detectCycle("B", "A", existing)).toThrow(CycleDetectionError);
    expect(() => detectCycle("B", "A", existing)).toThrow(
      "Adding this relationship would create a cycle"
    );
  });

  it("should throw on transitive cycle: A→B, B→C exist, adding C→A", () => {
    const existing = [rel("A", "B"), rel("B", "C")];
    expect(() => detectCycle("C", "A", existing)).toThrow(CycleDetectionError);
  });

  it("should throw on deep chain cycle: 10-node chain, closing the loop", () => {
    const nodes = Array.from({ length: 10 }, (_, i) => `N${i}`);
    const existing = nodes.slice(0, -1).map((n, i) => rel(n, nodes[i + 1]));
    // N0→N1→N2→...→N9, adding N9→N0 creates a cycle
    expect(() => detectCycle("N9", "N0", existing)).toThrow(CycleDetectionError);
  });

  it("should allow tree shape (no cycle): A→B, A→C, B→D", () => {
    const existing = [rel("A", "B"), rel("A", "C"), rel("B", "D")];
    expect(() => detectCycle("C", "E", existing)).not.toThrow();
  });

  it("should allow diamond shape: A→B, A→C, B→D, C→D (two parents)", () => {
    const existing = [rel("A", "B"), rel("A", "C"), rel("B", "D"), rel("C", "D")];
    // Adding E→D (another parent) is fine
    expect(() => detectCycle("E", "D", existing)).not.toThrow();
  });

  it("should throw on self-referential: A→A", () => {
    expect(() => detectCycle("A", "A", [])).toThrow(CycleDetectionError);
    expect(() => detectCycle("A", "A", [])).toThrow(
      "A member cannot be their own parent"
    );
  });

  it("should allow after deletion scenario: missing middle node means no cycle", () => {
    // Originally A→B→C, but B→C was removed. Adding C→A should be fine.
    const existing = [rel("A", "B")];
    expect(() => detectCycle("C", "A", existing)).not.toThrow();
  });

  it("should ignore non-parent_child relationships for cycle detection", () => {
    // A→B (spouse), adding B→A (parent_child) should not detect cycle from spouse edge
    const existing = [rel("A", "B", "spouse")];
    expect(() => detectCycle("B", "A", existing)).not.toThrow();
  });

  it("should handle performance: 500+ node chain without timeout", () => {
    const count = 500;
    const nodes = Array.from({ length: count }, (_, i) => `P${i}`);
    const existing = nodes.slice(0, -1).map((n, i) => rel(n, nodes[i + 1]));

    // Adding a new leaf should be fast and not cycle
    expect(() => detectCycle("P0", "LEAF", existing)).not.toThrow();

    // Closing the loop should detect cycle
    expect(() => detectCycle(`P${count - 1}`, "P0", existing)).toThrow(
      CycleDetectionError
    );
  });

  it("should allow adding edge to disconnected node", () => {
    const existing = [rel("A", "B"), rel("B", "C")];
    expect(() => detectCycle("X", "Y", existing)).not.toThrow();
  });

  it("should handle empty relationships array", () => {
    expect(() => detectCycle("A", "B", [])).not.toThrow();
  });
});
