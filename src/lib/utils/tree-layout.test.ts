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
