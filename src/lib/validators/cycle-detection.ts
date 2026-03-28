export class CycleDetectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CycleDetectionError";
  }
}

interface MinimalRelationship {
  from_member_id: string;
  to_member_id: string;
  relationship_type: string;
}

/**
 * Check if adding a parent_child edge from `fromId` to `toId` would create a cycle.
 * Uses DFS on existing parent_child relationships.
 *
 * The adjacency list represents parent -> children direction.
 * A cycle exists if, starting from `toId` and following parent->child edges,
 * we can reach `fromId` — meaning `fromId` is already a descendant of `toId`.
 *
 * @param fromId - The parent member ID
 * @param toId - The child member ID
 * @param existingRelationships - All existing relationships in the tree
 * @throws CycleDetectionError if a cycle would be created
 */
export function detectCycle(
  fromId: string,
  toId: string,
  existingRelationships: MinimalRelationship[]
): void {
  // Self-referential check
  if (fromId === toId) {
    throw new CycleDetectionError(
      "A member cannot be their own parent"
    );
  }

  // Filter to parent_child only
  const parentChildEdges = existingRelationships.filter(
    (r) => r.relationship_type === "parent_child"
  );

  // Build adjacency list: parent -> [children]
  const adjacency = new Map<string, string[]>();

  for (const edge of parentChildEdges) {
    const children = adjacency.get(edge.from_member_id);
    if (children) {
      children.push(edge.to_member_id);
    } else {
      adjacency.set(edge.from_member_id, [edge.to_member_id]);
    }
  }

  // Add the proposed edge
  const existingChildren = adjacency.get(fromId);
  if (existingChildren) {
    existingChildren.push(toId);
  } else {
    adjacency.set(fromId, [toId]);
  }

  // DFS from toId: if we can reach fromId, there is a cycle
  const visited = new Set<string>();
  const stack: string[] = [toId];

  while (stack.length > 0) {
    const current = stack.pop()!;

    if (current === fromId) {
      throw new CycleDetectionError(
        "Adding this relationship would create a cycle in the family tree"
      );
    }

    if (visited.has(current)) continue;
    visited.add(current);

    const children = adjacency.get(current);
    if (children) {
      for (const child of children) {
        if (!visited.has(child)) {
          stack.push(child);
        }
      }
    }
  }
}
