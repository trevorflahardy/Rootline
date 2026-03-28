"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitMerge, GitBranch } from "lucide-react";

export interface CoupleBlockNodeData {
  parent1Id: string;
  parent2Id: string;
  arcId: string;
  joinEnabled: boolean;
  onToggle: (arcId: string) => void;
  [key: string]: unknown;
}

function CoupleBlockNodeComponent({ data }: NodeProps & { data: CoupleBlockNodeData }) {
  return (
    <>
      {/* Transparent block background (pointer-events-none so clicks pass through to nodes) */}
      <div
        className="w-full h-full rounded-2xl pointer-events-none"
        style={{
          backgroundColor: "oklch(0.62 0.12 280 / 0.07)",
          border: "1.5px solid oklch(0.62 0.12 280 / 0.28)",
        }}
      />

      {/* Toggle: join/separate edges — top-right corner */}
      <button
        onClick={(e) => { e.stopPropagation(); data.onToggle(data.arcId); }}
        className="absolute top-2 right-2 rounded-full p-1 transition-all"
        aria-label={data.joinEnabled ? "Separate child edges" : "Join child edges"}
        style={{
          background: data.joinEnabled
            ? "oklch(0.62 0.12 280 / 0.22)"
            : "oklch(0.5 0 0 / 0.12)",
          border: "1px solid oklch(0.62 0.12 280 / 0.45)",
          pointerEvents: "auto",
        }}
        title={data.joinEnabled ? "Separate child edges" : "Join child edges"}
      >
        {data.joinEnabled ? (
          <GitMerge className="h-3 w-3" style={{ color: "oklch(0.62 0.12 280)" }} />
        ) : (
          <GitBranch className="h-3 w-3" style={{ color: "oklch(0.5 0 0 / 0.55)" }} />
        )}
      </button>

      {/* Bottom source handle — drag to connect children to both parents */}
      <Handle
        id="couple-bottom"
        type="source"
        position={Position.Bottom}
        className="w-5! h-5! rounded-full! min-w-0! min-h-0! transition-opacity"
        style={{
          background: "oklch(0.62 0.12 280 / 0.18)",
          border: "2px solid oklch(0.62 0.12 280 / 0.65)",
        }}
        title="Drag to add child for both parents"
      />
    </>
  );
}

export const CoupleBlockNode = memo(CoupleBlockNodeComponent);
