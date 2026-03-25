"use client";

import { memo } from "react";
import { useNodes, type EdgeProps } from "@xyflow/react";
import { NODE_WIDTH, NODE_HEIGHT } from "@/lib/utils/tree-layout";
import type { EdgeHighlightMode } from "./relationship-edge";

// Use measured dimensions when available (React Flow sets these after first render)
function nodeW(n: { measured?: { width?: number } }) {
  return n.measured?.width ?? NODE_WIDTH;
}
function nodeH(n: { measured?: { height?: number } }) {
  return n.measured?.height ?? NODE_HEIGHT;
}

export interface FamilyArcEdgeData {
  isFamilyArc: true;
  arcId: string;
  parent1Id: string;
  parent2Id: string;
  childIds: string[];
  originalRelIds: string[];
  highlightMode?: EdgeHighlightMode;
  [key: string]: unknown;
}

const JUNCTION_OFFSET = 28; // px below the block's bottom edge
const ARROW = 5;

function FamilyArcEdgeComponent({ data }: EdgeProps & { data?: FamilyArcEdgeData }) {
  const nodes = useNodes();

  if (!data?.isFamilyArc) return null;

  // Source: the couple-block node for this arc
  const blockNode = nodes.find((n) => n.id === `block-${data.arcId}`);
  const children = data.childIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is NonNullable<typeof n> => n != null);

  if (!blockNode || children.length === 0) return null;

  const color =
    data.highlightMode === "hover" || data.highlightMode === "path"
      ? "oklch(0.45 0.18 155)"
      : data.highlightMode === "descendant"
        ? "oklch(0.62 0.12 210)"
        : "oklch(0.55 0 0 / 0.6)";

  const blockW = (blockNode.width as number | undefined) ?? nodeW(blockNode);
  const blockH = (blockNode.height as number | undefined) ?? nodeH(blockNode);

  // Source point: bottom-center of the couple-block (where the Handle sits)
  const srcX = blockNode.position.x + blockW / 2;
  const srcY = blockNode.position.y + blockH;

  // Junction sits just below the block bottom, horizontally centred
  const jX = srcX;
  const jY = srcY + JUNCTION_OFFSET;

  return (
    <g>
      {/* Block bottom → junction */}
      <path
        d={`M ${srcX} ${srcY} L ${jX} ${jY}`}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Junction dot (only meaningful when there are multiple children) */}
      {children.length > 1 && (
        <circle cx={jX} cy={jY} r={3} fill={color} />
      )}
      {/* Junction → each child */}
      {children.map((child) => {
        const cX = child.position.x + nodeW(child) / 2;
        const cY = child.position.y;
        const midY = (jY + cY) / 2;
        return (
          <g key={child.id}>
            <path
              d={`M ${jX} ${jY} C ${jX} ${midY}, ${cX} ${midY}, ${cX} ${cY}`}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            <path
              d={`M ${cX - ARROW} ${cY - ARROW * 1.6} L ${cX} ${cY} L ${cX + ARROW} ${cY - ARROW * 1.6}`}
              fill={color}
              stroke={color}
              strokeWidth={1}
              strokeLinejoin="round"
            />
          </g>
        );
      })}
    </g>
  );
}

export const FamilyArcEdge = memo(FamilyArcEdgeComponent);
