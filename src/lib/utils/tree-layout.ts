import dagre from "@dagrejs/dagre";
import type { TreeMember, Relationship } from "@/types";

export interface LayoutNode {
  id: string;
  position: { x: number; y: number };
  data: TreeMember;
  type: "member";
}

export interface FamilyArcData {
  isFamilyArc: true;
  arcId: string;
  parent1Id: string;
  parent2Id: string;
  childIds: string[];
  originalRelIds: string[];
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  type: "relationship" | "family-arc";
  sourceHandle?: string;
  targetHandle?: string;
  data:
    | { relationship_type: Relationship["relationship_type"]; relationship_id: string }
    | FamilyArcData;
}

export interface CoParentGroup {
  parent1Id: string;
  parent2Id: string;
  sharedChildIds: string[];
  coveredRelIds: string[];
  arcId: string;
}

function findCoParentGroups(relationships: Relationship[]): CoParentGroup[] {
  const groups: CoParentGroup[] = [];
  const spousePairs = relationships.filter(
    (r) => r.relationship_type === "spouse" || r.relationship_type === "divorced"
  );
  for (const pair of spousePairs) {
    const p1 = pair.from_member_id;
    const p2 = pair.to_member_id;
    const childrenOf = (parentId: string) =>
      new Set(
        relationships
          .filter(
            (r) =>
              r.from_member_id === parentId &&
              (r.relationship_type === "parent_child" || r.relationship_type === "adopted")
          )
          .map((r) => r.to_member_id)
      );
    const p1Kids = childrenOf(p1);
    const p2Kids = childrenOf(p2);
    const shared = [...p1Kids].filter((id) => p2Kids.has(id));
    const coveredRelIds = shared.length > 0
      ? relationships
          .filter(
            (r) =>
              (r.from_member_id === p1 || r.from_member_id === p2) &&
              shared.includes(r.to_member_id) &&
              (r.relationship_type === "parent_child" || r.relationship_type === "adopted")
          )
          .map((r) => r.id)
      : [];
    // Include ALL spouse/divorced pairs — even without shared children — so every couple gets a block node
    groups.push({ parent1Id: p1, parent2Id: p2, sharedChildIds: shared, coveredRelIds, arcId: `arc-${pair.id}` });
  }
  return groups;
}

export interface TreeLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  coParentGroups: CoParentGroup[];
}

const NODE_WIDTH = 200;
const NODE_HEIGHT = 100;

/**
 * Computes the layout for a family tree using Dagre's hierarchical algorithm.
 * Returns nodes with positions and edges for React Flow.
 */
export function computeTreeLayout(
  members: TreeMember[],
  relationships: Relationship[],
  joinEnabledMap?: Map<string, boolean>
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

  // Post-process: align spouses/divorced partners to same Y and nudge side-by-side
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const rel of relationships) {
    if (rel.relationship_type !== "spouse" && rel.relationship_type !== "divorced") continue;
    const nodeA = nodeMap.get(rel.from_member_id);
    const nodeB = nodeMap.get(rel.to_member_id);
    if (!nodeA || !nodeB) continue;
    // Align to the deeper Y so spouses sit at the correct generation level
    const targetY = Math.max(nodeA.position.y, nodeB.position.y);
    nodeA.position = { ...nodeA.position, y: targetY };
    nodeB.position = { ...nodeB.position, y: targetY };
    // If they are far apart horizontally, place B immediately to the right of A
    const xDist = Math.abs(nodeA.position.x - nodeB.position.x);
    if (xDist > NODE_WIDTH * 2 + 60) {
      nodeB.position = { x: nodeA.position.x + NODE_WIDTH + 60, y: targetY };
    }
  }

  // Detect co-parent groups and build family-arc edges for shared children
  const coParentGroups = findCoParentGroups(relationships);
  // Only cover rel IDs for groups where join is enabled (default: true)
  const coveredRelIdSet = new Set(
    coParentGroups
      .filter((g) => joinEnabledMap?.get(g.arcId) !== false)
      .flatMap((g) => g.coveredRelIds)
  );

  const edges: LayoutEdge[] = [];

  // One family-arc edge per co-parent group — skip if no shared children or join is disabled
  for (const group of coParentGroups) {
    if (group.sharedChildIds.length === 0) continue;
    if (joinEnabledMap?.get(group.arcId) === false) continue;
    edges.push({
      id: group.arcId,
      source: group.parent1Id,
      target: group.sharedChildIds[0], // valid React Flow source/target
      type: "family-arc",
      data: {
        isFamilyArc: true,
        arcId: group.arcId,
        parent1Id: group.parent1Id,
        parent2Id: group.parent2Id,
        childIds: group.sharedChildIds,
        originalRelIds: group.coveredRelIds,
      },
    });
  }

  // All remaining edges (non-covered parent-child + all other types)
  for (const rel of relationships) {
    if (coveredRelIdSet.has(rel.id)) continue;
    const isMarriage = rel.relationship_type === "spouse" || rel.relationship_type === "divorced";
    edges.push({
      id: rel.id,
      source: rel.from_member_id,
      target: rel.to_member_id,
      type: "relationship",
      sourceHandle: isMarriage ? "right" : "bottom",
      targetHandle: isMarriage ? "left" : "top",
      data: {
        relationship_type: rel.relationship_type,
        relationship_id: rel.id,
      },
    });
  }

  return { nodes, edges, coParentGroups };
}

export { NODE_WIDTH, NODE_HEIGHT };
