/**
 * Graph validation utilities for family tree relationships.
 * Pure functions -- no Supabase, no async.
 */

export class GraphValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphValidationError";
  }
}

/** Symmetric relationship types where A->B is the same as B->A */
const SYMMETRIC_TYPES = new Set(["spouse", "divorced", "sibling"]);

/**
 * Check if a relationship between the same two members of the same type
 * already exists. For symmetric types (spouse, divorced, sibling), check
 * both directions.
 *
 * @param fromId - The source member ID
 * @param toId - The target member ID
 * @param type - The relationship type
 * @param existingRelationships - Array of existing relationships to check against
 * @throws {GraphValidationError} If a duplicate relationship is found
 */
export function detectDuplicateRelationship(
  fromId: string,
  toId: string,
  type: string,
  existingRelationships: Array<{
    from_member_id: string;
    to_member_id: string;
    relationship_type: string;
  }>
): void {
  const isSymmetric = SYMMETRIC_TYPES.has(type);

  for (const rel of existingRelationships) {
    if (rel.relationship_type !== type) {
      continue;
    }

    const exactMatch =
      rel.from_member_id === fromId && rel.to_member_id === toId;
    const reverseMatch =
      isSymmetric &&
      rel.from_member_id === toId &&
      rel.to_member_id === fromId;

    if (exactMatch || reverseMatch) {
      throw new GraphValidationError(
        `A ${type} relationship between these members already exists`
      );
    }
  }
}

/**
 * Find members with zero relationships (orphan nodes).
 *
 * @param memberIds - All member IDs in the tree
 * @param relationships - All relationships in the tree
 * @returns Array of member IDs that have no relationships
 */
export function findOrphanNodes(
  memberIds: string[],
  relationships: Array<{ from_member_id: string; to_member_id: string }>
): string[] {
  const connected = new Set<string>();

  for (const rel of relationships) {
    connected.add(rel.from_member_id);
    connected.add(rel.to_member_id);
  }

  return memberIds.filter((id) => !connected.has(id));
}

/**
 * Calculate the maximum depth of the tree using BFS on parent_child
 * relationships. Returns the depth. Throws if depth exceeds maxDepth.
 *
 * Depth is defined as the length of the longest path from any root node
 * (a node with no parent) to a leaf node, counted in number of nodes.
 * A single root with no children has depth 1. No parent_child
 * relationships yields depth 0.
 *
 * @param relationships - All relationships in the tree
 * @param maxDepth - Maximum allowed depth (default 50)
 * @returns The actual depth of the tree
 * @throws {GraphValidationError} If depth exceeds maxDepth
 */
export function validateTreeDepth(
  relationships: Array<{
    from_member_id: string;
    to_member_id: string;
    relationship_type: string;
  }>,
  maxDepth: number = 50
): number {
  // Filter to parent_child only
  const parentChildRels = relationships.filter(
    (r) => r.relationship_type === "parent_child"
  );

  if (parentChildRels.length === 0) {
    return 0;
  }

  // Build adjacency list: parent -> children
  const childrenOf = new Map<string, string[]>();
  const allChildren = new Set<string>();
  const allNodes = new Set<string>();

  for (const rel of parentChildRels) {
    allNodes.add(rel.from_member_id);
    allNodes.add(rel.to_member_id);
    allChildren.add(rel.to_member_id);

    let children = childrenOf.get(rel.from_member_id);
    if (!children) {
      children = [];
      childrenOf.set(rel.from_member_id, children);
    }
    children.push(rel.to_member_id);
  }

  // Root nodes are those that never appear as a child
  const roots: string[] = [];
  for (const node of allNodes) {
    if (!allChildren.has(node)) {
      roots.push(node);
    }
  }

  // BFS from all roots to find maximum depth
  let maxFound = 0;
  const queue: Array<{ id: string; depth: number }> = [];

  for (const root of roots) {
    queue.push({ id: root, depth: 1 });
  }

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;

    if (depth > maxFound) {
      maxFound = depth;
    }

    const children = childrenOf.get(id);
    if (children) {
      for (const child of children) {
        queue.push({ id: child, depth: depth + 1 });
      }
    }
  }

  if (maxFound > maxDepth) {
    throw new GraphValidationError(
      `Tree depth ${maxFound} exceeds maximum allowed depth of ${maxDepth}`
    );
  }

  return maxFound;
}

/**
 * Validate that deleting a member cleans up correctly.
 * Returns the list of relationship IDs that would be affected.
 *
 * @param memberId - The member being deleted
 * @param relationships - All relationships in the tree
 * @returns Array of relationship IDs that reference this member
 */
export function findAffectedRelationships(
  memberId: string,
  relationships: Array<{
    id: string;
    from_member_id: string;
    to_member_id: string;
  }>
): string[] {
  return relationships
    .filter(
      (rel) =>
        rel.from_member_id === memberId || rel.to_member_id === memberId
    )
    .map((rel) => rel.id);
}
