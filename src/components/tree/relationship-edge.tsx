"use client";

import { memo } from "react";
import {
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import type { RelationshipType } from "@/types";

export interface RelationshipEdgeData {
  relationship_type: RelationshipType;
  relationship_id: string;
  highlightMode?: EdgeHighlightMode;
  [key: string]: unknown;
}

export type EdgeHighlightMode = "none" | "descendant" | "path" | "hover";

function RelationshipEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps & { data?: RelationshipEdgeData }) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const highlightMode = data?.highlightMode ?? "none";
  const relType = data?.relationship_type ?? "parent_child";

  const strokeDasharray =
    relType === "spouse"
      ? "8 4"
      : relType === "divorced"
        ? "4 4"
        : relType === "adopted"
          ? "2 4"
          : undefined;

  const color =
    highlightMode === "hover" || highlightMode === "path"
      ? "oklch(0.45 0.18 155)"
      : highlightMode === "descendant"
        ? "oklch(0.62 0.12 210)"
        : "oklch(0.75 0 0)";

  const markerId = `arrow-${id}`;

  return (
    <g>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M 0 0 L 8 4 L 0 8 Z" fill={color} stroke={color} strokeWidth="1" />
        </marker>
      </defs>
      <path
        id={id}
        d={edgePath}
        fill="none"
        strokeDasharray={strokeDasharray}
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
        style={{ stroke: color, strokeWidth: 1.5 }}
      />
    </g>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
