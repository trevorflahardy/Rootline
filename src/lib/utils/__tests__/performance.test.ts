import { describe, it, expect } from "vitest";
import { computeTreeLayout } from "../tree-layout";
import { findPath } from "../path-finder";
import { calculateRelationship } from "../relationship-calculator";
import type { TreeMember, Relationship, RelationshipType } from "@/types";

/**
 * Helper: generate a TreeMember with a given id.
 */
function makeMember(id: string, treeId = "tree-1"): TreeMember {
  return {
    id,
    tree_id: treeId,
    first_name: `First${id}`,
    last_name: `Last${id}`,
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
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    created_by: null,
  };
}

/**
 * Helper: generate a Relationship.
 */
function makeRelationship(
  id: string,
  from: string,
  to: string,
  type: RelationshipType = "parent_child",
  treeId = "tree-1"
): Relationship {
  return {
    id,
    tree_id: treeId,
    from_member_id: from,
    to_member_id: to,
    relationship_type: type,
    start_date: null,
    end_date: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

/**
 * Generate a large tree: a chain of parent-child with branching.
 * Creates `count` members. Each member (except the first) has a parent-child
 * relationship to a previous member, forming a wide tree.
 */
function generateLargeTree(count: number) {
  const members: TreeMember[] = [];
  const relationships: Relationship[] = [];

  for (let i = 0; i < count; i++) {
    members.push(makeMember(`m${i}`));
  }

  // Create a tree structure: each member i>0 is a child of member floor((i-1)/3)
  // This creates a ternary tree with depth ~ log3(count)
  for (let i = 1; i < count; i++) {
    const parentIdx = Math.floor((i - 1) / 3);
    relationships.push(
      makeRelationship(`r${i}`, `m${parentIdx}`, `m${i}`, "parent_child")
    );
  }

  return { members, relationships };
}

/**
 * Generate a large graph with extra random-ish edges for path-finding tests.
 */
function generateLargeGraph(nodeCount: number, edgeCount: number) {
  const members: TreeMember[] = [];
  const relationships: Relationship[] = [];

  for (let i = 0; i < nodeCount; i++) {
    members.push(makeMember(`n${i}`));
  }

  // First, create a spanning tree so the graph is connected
  for (let i = 1; i < nodeCount; i++) {
    const parentIdx = Math.floor((i - 1) / 3);
    relationships.push(
      makeRelationship(`e${i}`, `n${parentIdx}`, `n${i}`, "parent_child")
    );
  }

  // Add additional edges to reach edgeCount
  let edgeId = nodeCount;
  const horizontalTypes: RelationshipType[] = ["spouse", "sibling", "in_law"];
  while (relationships.length < edgeCount) {
    const a = Math.floor((edgeId * 7 + 3) % nodeCount);
    const b = Math.floor((edgeId * 13 + 7) % nodeCount);
    if (a !== b) {
      const type = horizontalTypes[edgeId % horizontalTypes.length];
      relationships.push(makeRelationship(`e${edgeId}`, `n${a}`, `n${b}`, type));
    }
    edgeId++;
  }

  return { members, relationships };
}

describe("Performance: computeTreeLayout", () => {
  it("handles 500 members + 600 relationships in <2 seconds", () => {
    const { members } = generateLargeTree(500);
    // We need 600 relationships total; the tree gives us 499, add more horizontal ones
    const relationships: Relationship[] = [];
    for (let i = 1; i < 500; i++) {
      const parentIdx = Math.floor((i - 1) / 3);
      relationships.push(
        makeRelationship(`r${i}`, `m${parentIdx}`, `m${i}`, "parent_child")
      );
    }
    // Add 101 more spouse relationships
    for (let i = 0; i < 101; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      if (b < 500) {
        relationships.push(
          makeRelationship(`rs${i}`, `m${a}`, `m${b}`, "spouse")
        );
      }
    }

    const start = performance.now();
    const layout = computeTreeLayout(members, relationships);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(2000);
    expect(layout.nodes).toHaveLength(500);
    expect(layout.edges.length).toBeGreaterThanOrEqual(499);
  });

  it("handles 100 members with all relationship types (siblings, in-laws, step-parents)", () => {
    const members: TreeMember[] = [];
    const relationships: Relationship[] = [];

    for (let i = 0; i < 100; i++) {
      members.push(makeMember(`m${i}`));
    }

    // Hierarchical relationships
    for (let i = 1; i < 40; i++) {
      const parentIdx = Math.floor((i - 1) / 2);
      relationships.push(makeRelationship(`r${i}`, `m${parentIdx}`, `m${i}`, "parent_child"));
    }

    // Add all relationship types
    const allTypes: RelationshipType[] = [
      "spouse", "divorced", "adopted", "sibling",
      "step_parent", "step_child", "in_law", "guardian",
    ];
    for (let i = 0; i < allTypes.length; i++) {
      const from = 40 + i * 2;
      const to = 40 + i * 2 + 1;
      relationships.push(makeRelationship(`rt${i}`, `m${from}`, `m${to}`, allTypes[i]));
    }

    const layout = computeTreeLayout(members, relationships);

    expect(layout.nodes).toHaveLength(100);
    // All relationship types should be present in edges
    const edgeTypes = new Set(layout.edges.map((e) => e.data.relationship_type));
    for (const t of allTypes) {
      expect(edgeTypes.has(t)).toBe(true);
    }
  });

  it("produces valid positions (no NaN, no exact overlaps)", () => {
    const { members, relationships } = generateLargeTree(200);
    const layout = computeTreeLayout(members, relationships);

    const positionSet = new Set<string>();
    for (const node of layout.nodes) {
      expect(Number.isNaN(node.position.x)).toBe(false);
      expect(Number.isNaN(node.position.y)).toBe(false);
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);

      const key = `${node.position.x},${node.position.y}`;
      // No two nodes should have the exact same position
      expect(positionSet.has(key)).toBe(false);
      positionSet.add(key);
    }
  });

  it("tree layout with mixed horizontal and vertical relationships maintains hierarchy", () => {
    // Build a small tree: grandparent -> parent -> child, with spouses at each level
    const members = [
      makeMember("gp"), makeMember("gp_spouse"),
      makeMember("p1"), makeMember("p1_spouse"),
      makeMember("c1"), makeMember("c2"),
    ];
    const relationships = [
      makeRelationship("r1", "gp", "p1", "parent_child"),
      makeRelationship("r2", "p1", "c1", "parent_child"),
      makeRelationship("r3", "p1", "c2", "parent_child"),
      makeRelationship("r4", "gp", "gp_spouse", "spouse"),
      makeRelationship("r5", "p1", "p1_spouse", "spouse"),
      makeRelationship("r6", "c1", "c2", "sibling"),
    ];

    const layout = computeTreeLayout(members, relationships);

    // Find node positions
    const pos = (id: string) => layout.nodes.find((n) => n.id === id)!.position;

    // Grandparent should be above parent, parent above children (y increases downward in TB layout)
    expect(pos("gp").y).toBeLessThan(pos("p1").y);
    expect(pos("p1").y).toBeLessThan(pos("c1").y);
    expect(pos("p1").y).toBeLessThan(pos("c2").y);
  });
});

describe("Performance: findPath", () => {
  it("finds path on large graph (500 nodes, 600 edges) in <500ms", () => {
    const { relationships } = generateLargeGraph(500, 600);

    const start = performance.now();
    const path = findPath(relationships, "n0", "n499");
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(path).not.toBeNull();
    expect(path![0].memberId).toBe("n0");
    expect(path![path!.length - 1].memberId).toBe("n499");
  });

  it("returns null for disconnected nodes in large graph", () => {
    // Create two separate connected components
    const relationships: Relationship[] = [];

    // Component 1: nodes n0..n249
    for (let i = 1; i < 250; i++) {
      const parentIdx = Math.floor((i - 1) / 3);
      relationships.push(
        makeRelationship(`e${i}`, `n${parentIdx}`, `n${i}`, "parent_child")
      );
    }

    // Component 2: nodes n250..n499
    for (let i = 251; i < 500; i++) {
      const parentIdx = 250 + Math.floor((i - 251) / 3);
      relationships.push(
        makeRelationship(`f${i}`, `n${parentIdx}`, `n${i}`, "parent_child")
      );
    }

    const path = findPath(relationships, "n0", "n499");
    expect(path).toBeNull();
  });
});

describe("Performance: calculateRelationship deep paths", () => {
  it("handles deep paths (20+ steps) without stack overflow", () => {
    // Create a path that goes 25 steps up
    const path = [
      { memberId: "start", relationshipId: null as string | null, relationshipType: null as RelationshipType | null, direction: null as "up" | "down" | "spouse" | null },
    ];
    for (let i = 1; i <= 25; i++) {
      path.push({
        memberId: `ancestor${i}`,
        relationshipId: `r${i}`,
        relationshipType: "parent_child" as const,
        direction: "up" as const,
      });
    }

    const result = calculateRelationship(path);
    // 25 ups = Great-Great-...-Grandparent (23 "Great-" prefixes + Grandparent)
    expect(result).toContain("Grandparent");
    expect(result).toContain("Great-");
  });

  it("handles all 9 relationship types in a path", () => {
    // This path traverses various relationship types;
    // calculateRelationship counts ups/downs/spouse directions
    const allTypes: RelationshipType[] = [
      "parent_child", "spouse", "divorced", "adopted",
      "sibling", "step_parent", "step_child", "in_law", "guardian",
    ];

    // Build a path where we go up (parent_child), spouse, up (adopted),
    // spouse (sibling), up (step_parent), down (step_child reversed),
    // spouse (in_law), down (guardian)
    const path = [
      { memberId: "m0", relationshipId: null, relationshipType: null, direction: null as "up" | "down" | "spouse" | null },
      { memberId: "m1", relationshipId: "r1", relationshipType: "parent_child" as const, direction: "up" as const },
      { memberId: "m2", relationshipId: "r2", relationshipType: "spouse" as const, direction: "spouse" as const },
      { memberId: "m3", relationshipId: "r3", relationshipType: "adopted" as const, direction: "up" as const },
      { memberId: "m4", relationshipId: "r4", relationshipType: "sibling" as const, direction: "spouse" as const },
      { memberId: "m5", relationshipId: "r5", relationshipType: "step_parent" as const, direction: "down" as const },
      { memberId: "m6", relationshipId: "r6", relationshipType: "step_child" as const, direction: "down" as const },
      { memberId: "m7", relationshipId: "r7", relationshipType: "in_law" as const, direction: "spouse" as const },
      { memberId: "m8", relationshipId: "r8", relationshipType: "guardian" as const, direction: "down" as const },
      { memberId: "m9", relationshipId: "r9", relationshipType: "divorced" as const, direction: "spouse" as const },
    ];

    // Should not throw — the function should handle any combination
    const result = calculateRelationship(path);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
