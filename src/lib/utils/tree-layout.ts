import dagre from "@dagrejs/dagre";
import type { TreeMember, Relationship } from "@/types";

export interface LayoutNode {
  id: string;
  position: { x: number; y: number };
  data: TreeMember;
  type: "member";
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  type: "relationship";
  data: {
    relationship_type: Relationship["relationship_type"];
    relationship_id: string;
  };
}

export interface TreeLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
}

const NODE_WIDTH = 200;
const NODE_HEIGHT = 100;

/**
 * Computes the layout for a family tree using Dagre's hierarchical algorithm.
 * Returns nodes with positions and edges for React Flow.
 */
export function computeTreeLayout(
  members: TreeMember[],
  relationships: Relationship[]
): TreeLayout {
  const g = new dagre.graphlib.Graph();

  g.setGraph({
    rankdir: "TB", // Top to bottom
    nodesep: 80,
    ranksep: 120,
    marginx: 40,
    marginy: 40,
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Add all members as nodes
  for (const member of members) {
    g.setNode(member.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Add relationships as edges
  // Hierarchical types create dagre edges; horizontal types (spouse, divorced, sibling, in_law) do not
  for (const rel of relationships) {
    if (
      rel.relationship_type === "parent_child" ||
      rel.relationship_type === "adopted" ||
      rel.relationship_type === "step_parent" ||
      rel.relationship_type === "guardian"
    ) {
      // from_member is parent/guardian, to_member is child/ward
      g.setEdge(rel.from_member_id, rel.to_member_id);
    } else if (rel.relationship_type === "step_child") {
      // Reversed: to_member is the parent figure
      g.setEdge(rel.to_member_id, rel.from_member_id);
    }
  }

  dagre.layout(g);

  // Build React Flow nodes
  const nodes: LayoutNode[] = members.map((member) => {
    const nodeWithPosition = g.node(member.id);
    return {
      id: member.id,
      type: "member" as const,
      position: {
        x: (nodeWithPosition?.x ?? 0) - NODE_WIDTH / 2,
        y: (nodeWithPosition?.y ?? 0) - NODE_HEIGHT / 2,
      },
      data: member,
    };
  });

  // Build React Flow edges (include all relationship types)
  const edges: LayoutEdge[] = relationships.map((rel) => ({
    id: rel.id,
    source: rel.from_member_id,
    target: rel.to_member_id,
    type: "relationship" as const,
    data: {
      relationship_type: rel.relationship_type,
      relationship_id: rel.id,
    },
  }));

  return { nodes, edges };
}

export { NODE_WIDTH, NODE_HEIGHT };
