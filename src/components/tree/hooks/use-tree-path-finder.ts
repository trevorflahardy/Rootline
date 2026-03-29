"use client";

import { useCallback, useMemo, useState } from "react";
import { findPath, getPathRelationshipIds } from "@/lib/utils/path-finder";
import { calculateRelationship } from "@/lib/utils/relationship-calculator";
import type { Relationship } from "@/types";

export function useTreePathFinder(relationships: Relationship[]) {
  const [pathStart, setPathStart] = useState<string | null>(null);
  const [pathEnd, setPathEnd] = useState<string | null>(null);

  const { highlightedPath, highlightedEdges, relationshipLabel } = useMemo(() => {
    if (pathStart && pathEnd && pathStart !== pathEnd) {
      const path = findPath(relationships, pathStart, pathEnd);
      if (path) {
        return {
          highlightedPath: path.map((s) => s.memberId),
          highlightedEdges: getPathRelationshipIds(path),
          relationshipLabel: calculateRelationship(path),
        };
      }
      return {
        highlightedPath: [] as string[],
        highlightedEdges: [] as string[],
        relationshipLabel: "No connection found",
      };
    }
    return {
      highlightedPath: [] as string[],
      highlightedEdges: [] as string[],
      relationshipLabel: null as string | null,
    };
  }, [pathStart, pathEnd, relationships]);

  const clearPath = useCallback(() => {
    setPathStart(null);
    setPathEnd(null);
  }, []);

  return {
    pathStart,
    setPathStart,
    pathEnd,
    setPathEnd,
    highlightedPath,
    highlightedEdges,
    relationshipLabel,
    clearPath,
  };
}
