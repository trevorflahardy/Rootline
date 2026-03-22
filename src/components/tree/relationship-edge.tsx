"use client";

import { memo } from "react";
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import type { RelationshipType } from "@/types";

export interface RelationshipEdgeData {
  relationship_type: RelationshipType;
  relationship_id: string;
  isHighlighted?: boolean;
  [key: string]: unknown;
}

function RelationshipEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
}: EdgeProps & { data?: RelationshipEdgeData }) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  });

  const isHighlighted = data?.isHighlighted ?? false;
  const relType = data?.relationship_type ?? "parent_child";

  const strokeDasharray =
    relType === "spouse"
      ? "8 4"
      : relType === "divorced"
        ? "4 4"
        : relType === "adopted"
          ? "2 4"
          : undefined;

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        ...style,
        stroke: isHighlighted
          ? "oklch(0.6 0.15 155)"
          : "oklch(0.7 0.02 75)",
        strokeWidth: isHighlighted ? 3 : 1.5,
        strokeDasharray,
        transition: "stroke 0.3s, stroke-width 0.3s",
      }}
    />
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
