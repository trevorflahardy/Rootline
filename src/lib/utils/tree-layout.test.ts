import { describe, it, expect } from "vitest";
import { computeTreeLayout } from "./tree-layout";
import type { TreeMember, Relationship } from "@/types";

function makeMember(id: string, firstName: string): TreeMember {
  return {
    id,
    tree_id: "tree-1",
    first_name: firstName,
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
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    created_by: null,
  };
}

function makeRel(id: string, from: string, to: string): Relationship {
  return {
    id,
    tree_id: "tree-1",
    from_member_id: from,
    to_member_id: to,
    relationship_type: "parent_child",
    start_date: null,
    end_date: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("computeTreeLayout", () => {
  it("returns empty layout for no members", () => {
    const layout = computeTreeLayout([], []);
    expect(layout.nodes).toHaveLength(0);
    expect(layout.edges).toHaveLength(0);
  });

  it("returns single node for single member", () => {
    const members = [makeMember("a", "Alice")];
    const layout = computeTreeLayout(members, []);
    expect(layout.nodes).toHaveLength(1);
    expect(layout.nodes[0].id).toBe("a");
    expect(layout.nodes[0].data.first_name).toBe("Alice");
    expect(layout.nodes[0].type).toBe("member");
  });

  it("positions parent above child", () => {
    const members = [makeMember("parent", "Parent"), makeMember("child", "Child")];
    const rels = [makeRel("r1", "parent", "child")];
    const layout = computeTreeLayout(members, rels);

    expect(layout.nodes).toHaveLength(2);
    expect(layout.edges).toHaveLength(1);

    const parentNode = layout.nodes.find((n) => n.id === "parent")!;
    const childNode = layout.nodes.find((n) => n.id === "child")!;
    expect(parentNode.position.y).toBeLessThan(childNode.position.y);
  });

  it("creates edges for all relationship types", () => {
    const members = [makeMember("a", "A"), makeMember("b", "B")];
    const rels: Relationship[] = [
      { ...makeRel("r1", "a", "b"), relationship_type: "spouse" },
    ];
    const layout = computeTreeLayout(members, rels);

    expect(layout.edges).toHaveLength(1);
    expect(layout.edges[0].data.relationship_type).toBe("spouse");
  });

  it("places siblings at the same rank (no hierarchy edge)", () => {
    const members = [makeMember("a", "Alice"), makeMember("b", "Bob")];
    const rels: Relationship[] = [
      { ...makeRel("r1", "a", "b"), relationship_type: "sibling" },
    ];
    const layout = computeTreeLayout(members, rels);
    const nodeA = layout.nodes.find((n) => n.id === "a")!;
    const nodeB = layout.nodes.find((n) => n.id === "b")!;
    // Siblings should be on same rank (same y) since no dagre hierarchy edge
    expect(nodeA.position.y).toBe(nodeB.position.y);
  });

  it("creates hierarchy for step_parent", () => {
    const members = [makeMember("step", "StepParent"), makeMember("child", "Child")];
    const rels: Relationship[] = [
      { ...makeRel("r1", "step", "child"), relationship_type: "step_parent" },
    ];
    const layout = computeTreeLayout(members, rels);
    const stepNode = layout.nodes.find((n) => n.id === "step")!;
    const childNode = layout.nodes.find((n) => n.id === "child")!;
    expect(stepNode.position.y).toBeLessThan(childNode.position.y);
  });

  it("does not create hierarchy for in_law", () => {
    const members = [makeMember("a", "A"), makeMember("b", "B")];
    const rels: Relationship[] = [
      { ...makeRel("r1", "a", "b"), relationship_type: "in_law" },
    ];
    const layout = computeTreeLayout(members, rels);
    const nodeA = layout.nodes.find((n) => n.id === "a")!;
    const nodeB = layout.nodes.find((n) => n.id === "b")!;
    expect(nodeA.position.y).toBe(nodeB.position.y);
  });

  it("creates hierarchy for guardian", () => {
    const members = [makeMember("g", "Guardian"), makeMember("w", "Ward")];
    const rels: Relationship[] = [
      { ...makeRel("r1", "g", "w"), relationship_type: "guardian" },
    ];
    const layout = computeTreeLayout(members, rels);
    const gNode = layout.nodes.find((n) => n.id === "g")!;
    const wNode = layout.nodes.find((n) => n.id === "w")!;
    expect(gNode.position.y).toBeLessThan(wNode.position.y);
  });

  it("handles three-generation tree", () => {
    const members = [
      makeMember("gp", "Grandparent"),
      makeMember("p", "Parent"),
      makeMember("c", "Child"),
    ];
    const rels = [makeRel("r1", "gp", "p"), makeRel("r2", "p", "c")];
    const layout = computeTreeLayout(members, rels);

    const gpNode = layout.nodes.find((n) => n.id === "gp")!;
    const pNode = layout.nodes.find((n) => n.id === "p")!;
    const cNode = layout.nodes.find((n) => n.id === "c")!;

    expect(gpNode.position.y).toBeLessThan(pNode.position.y);
    expect(pNode.position.y).toBeLessThan(cNode.position.y);
  });
});
