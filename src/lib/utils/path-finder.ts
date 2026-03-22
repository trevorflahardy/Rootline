import type { Relationship } from "@/types";

interface AdjacencyEntry {
  memberId: string;
  relationshipId: string;
  type: Relationship["relationship_type"];
}

/**
 * Builds an undirected adjacency list from relationships.
 */
function buildAdjacencyList(
  relationships: Relationship[]
): Map<string, AdjacencyEntry[]> {
  const adj = new Map<string, AdjacencyEntry[]>();

  for (const rel of relationships) {
    if (!adj.has(rel.from_member_id)) adj.set(rel.from_member_id, []);
    if (!adj.has(rel.to_member_id)) adj.set(rel.to_member_id, []);

    adj.get(rel.from_member_id)!.push({
      memberId: rel.to_member_id,
      relationshipId: rel.id,
      type: rel.relationship_type,
    });

    adj.get(rel.to_member_id)!.push({
      memberId: rel.from_member_id,
      relationshipId: rel.id,
      type: rel.relationship_type,
    });
  }

  return adj;
}

export interface PathStep {
  memberId: string;
  relationshipId: string | null;
  relationshipType: Relationship["relationship_type"] | null;
  direction: "up" | "down" | "spouse" | null; // null for start node
}

/**
 * Finds the shortest path between two members using BFS.
 * Returns the path as an array of steps, or null if no path exists.
 */
export function findPath(
  relationships: Relationship[],
  startId: string,
  endId: string
): PathStep[] | null {
  if (startId === endId) {
    return [{ memberId: startId, relationshipId: null, relationshipType: null, direction: null }];
  }

  const adj = buildAdjacencyList(relationships);

  if (!adj.has(startId) || !adj.has(endId)) return null;

  const visited = new Set<string>();
  const parent = new Map<string, { from: string; entry: AdjacencyEntry }>();
  const queue: string[] = [startId];
  visited.add(startId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === endId) {
      // Reconstruct path
      const path: PathStep[] = [];
      let node = endId;

      while (node !== startId) {
        const p = parent.get(node)!;
        const direction = getDirection(p.entry.type, p.from, p.entry.memberId, relationships);
        path.unshift({
          memberId: node,
          relationshipId: p.entry.relationshipId,
          relationshipType: p.entry.type,
          direction,
        });
        node = p.from;
      }

      path.unshift({
        memberId: startId,
        relationshipId: null,
        relationshipType: null,
        direction: null,
      });

      return path;
    }

    const neighbors = adj.get(current) ?? [];
    for (const entry of neighbors) {
      if (!visited.has(entry.memberId)) {
        visited.add(entry.memberId);
        parent.set(entry.memberId, { from: current, entry });
        queue.push(entry.memberId);
      }
    }
  }

  return null;
}

/**
 * Determines the direction of traversal for a relationship step.
 */
function getDirection(
  type: Relationship["relationship_type"],
  fromNode: string,
  toNode: string,
  relationships: Relationship[]
): "up" | "down" | "spouse" {
  if (type === "spouse" || type === "divorced") return "spouse";

  // Check the original direction of the parent_child relationship
  const rel = relationships.find(
    (r) =>
      (r.from_member_id === fromNode && r.to_member_id === toNode) ||
      (r.from_member_id === toNode && r.to_member_id === fromNode)
  );

  if (rel && rel.from_member_id === fromNode) {
    return "down"; // fromNode is parent, toNode is child — going down
  }
  return "up"; // going up toward parent
}

/**
 * Gets the IDs of all relationships along a path (for highlighting edges).
 */
export function getPathRelationshipIds(path: PathStep[]): string[] {
  return path
    .filter((step) => step.relationshipId !== null)
    .map((step) => step.relationshipId!);
}
