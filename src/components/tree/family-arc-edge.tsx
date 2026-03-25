"use client";

import { memo } from "react";
import { useNodes, type EdgeProps } from "@xyflow/react";
import { NODE_WIDTH, NODE_HEIGHT } from "@/lib/utils/tree-layout";

// Use measured dimensions when available (React Flow sets these after first render)
function nodeW(n: { measured?: { width?: number } }) {
  return n.measured?.width ?? NODE_WIDTH;
}
function nodeH(n: { measured?: { height?: number } }) {
  return n.measured?.height ?? NODE_HEIGHT;
}
import type { EdgeHighlightMode } from "./relationship-edge";

export interface FamilyArcEdgeData {
  isFamilyArc: true;
  parent1Id: string;
  parent2Id: string;
  childIds: string[];
  originalRelIds: string[];
  highlightMode?: EdgeHighlightMode;
  [key: string]: unknown;
}

const JUNCTION_OFFSET = 28; // px below the lower parent's bottom edge
const ARROW = 5;

function FamilyArcEdgeComponent({ data }: EdgeProps & { data?: FamilyArcEdgeData }) {
  const nodes = useNodes();

  if (!data?.isFamilyArc) return null;

  const p1 = nodes.find((n) => n.id === data.parent1Id);
  const p2 = nodes.find((n) => n.id === data.parent2Id);
  const children = data.childIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is NonNullable<typeof n> => n != null);

  if (!p1 || !p2 || children.length === 0) return null;

  const color =
    data.highlightMode === "hover" || data.highlightMode === "path"
      ? "oklch(0.45 0.18 155)"
      : data.highlightMode === "descendant"
        ? "oklch(0.62 0.12 210)"
        : "oklch(0.55 0 0 / 0.6)";

  const p1CX = p1.position.x + nodeW(p1) / 2;
  const p1BY = p1.position.y + nodeH(p1);
  const p2CX = p2.position.x + nodeW(p2) / 2;
  const p2BY = p2.position.y + nodeH(p2);

  // Junction sits below the lower parent, horizontally centred between them
  const jY = Math.max(p1BY, p2BY) + JUNCTION_OFFSET;
  const jX = (p1CX + p2CX) / 2;

  // Cubic bezier helper: vertical exit from parent, horizontal entry into junction
  const parentToJunction = (px: number, py: number) => {
    const midY = (py + jY) / 2;
    return `M ${px} ${py} C ${px} ${midY}, ${jX} ${midY}, ${jX} ${jY}`;
  };

  // Cubic bezier: leave junction horizontally, arrive at child vertically
  const junctionToChild = (cX: number, cY: number) => {
    const midY = (jY + cY) / 2;
    return `M ${jX} ${jY} C ${jX} ${midY}, ${cX} ${midY}, ${cX} ${cY}`;
  };

  return (
    <g>
      {/* parent1 → junction */}
      <path
        d={parentToJunction(p1CX, p1BY)}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* parent2 → junction */}
      <path
        d={parentToJunction(p2CX, p2BY)}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* junction dot */}
      <circle cx={jX} cy={jY} r={3} fill={color} />
      {/* junction → each child */}
      {children.map((child) => {
        const cX = child.position.x + nodeW(child) / 2;
        const cY = child.position.y;
        return (
          <g key={child.id}>
            <path
              d={junctionToChild(cX, cY)}
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
