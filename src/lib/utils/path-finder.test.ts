import { describe, it, expect } from "vitest";
import { findPath, getPathRelationshipIds } from "./path-finder";
import type { Relationship } from "@/types";

function makeRel(
  id: string,
  from: string,
  to: string,
  type: Relationship["relationship_type"] = "parent_child"
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

describe("findPath", () => {
  it("returns single step for same start and end", () => {
    const path = findPath([], "a", "a");
    expect(path).toHaveLength(1);
    expect(path![0].memberId).toBe("a");
    expect(path![0].direction).toBeNull();
  });

  it("finds direct parent-child path", () => {
    const rels = [makeRel("r1", "parent", "child")];
    const path = findPath(rels, "parent", "child");
    expect(path).toHaveLength(2);
    expect(path![0].memberId).toBe("parent");
    expect(path![1].memberId).toBe("child");
    expect(path![1].direction).toBe("down");
  });

  it("finds path going up to parent", () => {
    const rels = [makeRel("r1", "parent", "child")];
    const path = findPath(rels, "child", "parent");
    expect(path).toHaveLength(2);
    expect(path![1].direction).toBe("up");
  });

  it("finds sibling path (up then down)", () => {
    const rels = [
      makeRel("r1", "parent", "child1"),
      makeRel("r2", "parent", "child2"),
    ];
    const path = findPath(rels, "child1", "child2");
    expect(path).toHaveLength(3);
    expect(path![0].memberId).toBe("child1");
    expect(path![1].memberId).toBe("parent");
    expect(path![2].memberId).toBe("child2");
  });

  it("finds spouse relationship", () => {
    const rels = [makeRel("r1", "person1", "person2", "spouse")];
    const path = findPath(rels, "person1", "person2");
    expect(path).toHaveLength(2);
    expect(path![1].direction).toBe("spouse");
  });

  it("returns null when no path exists", () => {
    const rels = [makeRel("r1", "a", "b")];
    const path = findPath(rels, "a", "c");
    expect(path).toBeNull();
  });

  it("returns null when start node is not in graph", () => {
    const rels = [makeRel("r1", "a", "b")];
    const path = findPath(rels, "x", "b");
    expect(path).toBeNull();
  });

  it("finds multi-generation path (grandparent to grandchild)", () => {
    const rels = [
      makeRel("r1", "grandparent", "parent"),
      makeRel("r2", "parent", "child"),
    ];
    const path = findPath(rels, "grandparent", "child");
    expect(path).toHaveLength(3);
    expect(path![1].direction).toBe("down");
    expect(path![2].direction).toBe("down");
  });

  it("finds cousin path", () => {
    const rels = [
      makeRel("r1", "grandparent", "parent1"),
      makeRel("r2", "grandparent", "parent2"),
      makeRel("r3", "parent1", "cousin1"),
      makeRel("r4", "parent2", "cousin2"),
    ];
    const path = findPath(rels, "cousin1", "cousin2");
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThanOrEqual(4);
  });
});

describe("getPathRelationshipIds", () => {
  it("extracts relationship IDs from path", () => {
    const rels = [
      makeRel("r1", "a", "b"),
      makeRel("r2", "b", "c"),
    ];
    const path = findPath(rels, "a", "c")!;
    const ids = getPathRelationshipIds(path);
    expect(ids).toHaveLength(2);
    expect(ids).toContain("r1");
    expect(ids).toContain("r2");
  });
});
