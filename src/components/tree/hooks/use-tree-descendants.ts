"use client";

import { useMemo } from "react";
import type { Relationship } from "@/types";

interface DescendantHighlight {
  selectedDescendantNodeIds: Set<string>;
  selectedDescendantEdgeIds: Set<string>;
}

export function useTreeDescendants(
  selectedMemberId: string | null,
  relationships: Relationship[],
  descendantHighlightDepth: number
): DescendantHighlight {
  return useMemo(() => {
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();

    if (!selectedMemberId || descendantHighlightDepth === 0) {
      return { selectedDescendantNodeIds: nodeIds, selectedDescendantEdgeIds: edgeIds };
    }

    const queue: Array<{ id: string; depth: number }> = [{ id: selectedMemberId, depth: 0 }];
    const visited = new Set<string>([selectedMemberId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= descendantHighlightDepth) continue;

      for (const rel of relationships) {
        if (
          rel.from_member_id === current.id &&
          (rel.relationship_type === "parent_child" || rel.relationship_type === "adopted")
        ) {
          edgeIds.add(rel.id);
          nodeIds.add(rel.to_member_id);
          if (!visited.has(rel.to_member_id)) {
            visited.add(rel.to_member_id);
            queue.push({ id: rel.to_member_id, depth: current.depth + 1 });
          }
        }
      }
    }

    for (const rel of relationships) {
      if (
        (rel.relationship_type === "spouse" || rel.relationship_type === "divorced") &&
        (rel.from_member_id === selectedMemberId || rel.to_member_id === selectedMemberId)
      ) {
        edgeIds.add(rel.id);
        const spouseId =
          rel.from_member_id === selectedMemberId ? rel.to_member_id : rel.from_member_id;
        nodeIds.add(spouseId);
        const spouseQueue: Array<{ id: string; depth: number }> = [{ id: spouseId, depth: 0 }];
        const spouseVisited = new Set<string>([selectedMemberId, spouseId]);
        while (spouseQueue.length > 0) {
          const current = spouseQueue.shift()!;
          if (current.depth >= descendantHighlightDepth) continue;
          for (const r of relationships) {
            if (
              r.from_member_id === current.id &&
              (r.relationship_type === "parent_child" || r.relationship_type === "adopted")
            ) {
              edgeIds.add(r.id);
              nodeIds.add(r.to_member_id);
              if (!spouseVisited.has(r.to_member_id)) {
                spouseVisited.add(r.to_member_id);
                spouseQueue.push({ id: r.to_member_id, depth: current.depth + 1 });
              }
            }
          }
        }
      }
    }

    return { selectedDescendantNodeIds: nodeIds, selectedDescendantEdgeIds: edgeIds };
  }, [descendantHighlightDepth, relationships, selectedMemberId]);
}
