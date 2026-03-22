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
}: EdgeProps & { data?: RelationshipEdgeData }) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
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

  const color = isHighlighted
    ? "oklch(0.45 0.18 155)"
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
          <path
            d="M 1 1 L 7 4 L 1 7"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray={strokeDasharray}
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
        className="react-flow__edge-path"
      />
    </g>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
