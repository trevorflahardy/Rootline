import type { PathStep } from "./path-finder";

/**
 * Calculates the human-readable relationship between two people
 * based on the path between them in the family tree.
 *
 * Uses the path steps (up/down/spouse directions) to determine
 * the genealogical relationship name.
 */
export function calculateRelationship(path: PathStep[]): string {
  if (path.length <= 1) return "Self";
  if (path.length === 2) {
    const step = path[1];
    // Check for specific extended relationship types first
    if (step.relationshipType === "sibling") return "Sibling";
    if (step.relationshipType === "in_law") return "In-Law";
    if (step.relationshipType === "step_parent") {
      return step.direction === "up" ? "Step-Parent" : "Step-Child";
    }
    if (step.relationshipType === "step_child") {
      return step.direction === "up" ? "Step-Child" : "Step-Parent";
    }
    if (step.relationshipType === "guardian") {
      return step.direction === "up" ? "Guardian" : "Ward";
    }
    if (step.direction === "spouse") return "Spouse";
    if (step.direction === "down") return "Child";
    if (step.direction === "up") return "Parent";
  }

  // Count ups (toward ancestors) and downs (toward descendants)
  let ups = 0;
  let downs = 0;
  let hasSpouse = false;

  for (let i = 1; i < path.length; i++) {
    const dir = path[i].direction;
    if (dir === "up") ups++;
    else if (dir === "down") downs++;
    else if (dir === "spouse") hasSpouse = true;
  }

  // Direct ancestor/descendant
  if (downs === 0 && !hasSpouse) {
    return getAncestorName(ups);
  }
  if (ups === 0 && !hasSpouse) {
    return getDescendantName(downs);
  }

  // Sibling: 1 up, 1 down
  if (ups === 1 && downs === 1 && !hasSpouse) {
    return "Sibling";
  }

  // Aunt/Uncle: 2 up, 1 down (or via spouse)
  if (ups === 2 && downs === 1 && !hasSpouse) {
    return "Aunt/Uncle";
  }

  // Niece/Nephew: 1 up, 2 down
  if (ups === 1 && downs === 2 && !hasSpouse) {
    return "Niece/Nephew";
  }

  // Cousins
  if (ups > 0 && downs > 0 && !hasSpouse) {
    return getCousinName(ups, downs);
  }

  // Spouse's relative or relative's spouse
  if (hasSpouse) {
    if (ups === 0 && downs === 0) return "Spouse";
    if (ups > 0 && downs === 0) return `Spouse's ${getAncestorName(ups)}`;
    if (ups === 0 && downs > 0) return `Spouse's ${getDescendantName(downs)}`;
    // In-law through cousin path
    const cousinName = getCousinName(ups, downs);
    return `${cousinName} (by marriage)`;
  }

  return `${ups} up, ${downs} down`;
}

function getAncestorName(generations: number): string {
  switch (generations) {
    case 1: return "Parent";
    case 2: return "Grandparent";
    case 3: return "Great-Grandparent";
    default: return `${"Great-".repeat(generations - 2)}Grandparent`;
  }
}

function getDescendantName(generations: number): string {
  switch (generations) {
    case 1: return "Child";
    case 2: return "Grandchild";
    case 3: return "Great-Grandchild";
    default: return `${"Great-".repeat(generations - 2)}Grandchild`;
  }
}

function getCousinName(ups: number, downs: number): string {
  // The "cousin number" is min(ups, downs) - 1
  // The "removed" count is the difference
  const minGen = Math.min(ups, downs);
  const cousinNumber = minGen - 1;
  const removed = Math.abs(ups - downs);

  if (cousinNumber === 0) {
    // Not really cousins — aunt/uncle/niece/nephew territory
    if (ups > downs) return "Aunt/Uncle" + (removed > 1 ? ` (${removed - 1}x great)` : "");
    return "Niece/Nephew" + (removed > 1 ? ` (${removed - 1}x great)` : "");
  }

  const ordinal = getOrdinal(cousinNumber);
  const cousinStr = `${ordinal} Cousin`;

  if (removed === 0) return cousinStr;

  const removedStr = removed === 1 ? "Once Removed" : `${removed}x Removed`;
  return `${cousinStr}, ${removedStr}`;
}

function getOrdinal(n: number): string {
  switch (n) {
    case 1: return "1st";
    case 2: return "2nd";
    case 3: return "3rd";
    default: return `${n}th`;
  }
}
