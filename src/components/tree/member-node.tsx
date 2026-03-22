"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { User, Crown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatLifespan } from "@/lib/utils/date";
import type { TreeMember } from "@/types";

export type MemberNodeData = TreeMember & {
  isSelected?: boolean;
  isPathHighlighted?: boolean;
  isOwnerNode?: boolean;
  [key: string]: unknown;
};

function MemberNodeComponent({ data, selected }: NodeProps & { data: MemberNodeData }) {
  const lifespan = formatLifespan(data.date_of_birth, data.date_of_death, data.is_deceased);

  const genderAccent =
    data.gender === "male"
      ? "border-chart-3/50"
      : data.gender === "female"
        ? "border-chart-4/50"
        : "border-border";

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2 !border-0" />

      <div
        className={cn(
          "rounded-xl border-2 bg-card shadow-sm px-4 py-3 min-w-[160px] max-w-[200px] transition-all duration-200 cursor-pointer",
          genderAccent,
          data.is_deceased && "opacity-70",
          selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          data.isPathHighlighted && "ring-2 ring-success ring-offset-2 ring-offset-background border-success/50",
        )}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className={cn(
              "h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold",
              data.is_deceased
                ? "bg-muted text-muted-foreground grayscale"
                : "bg-primary/10 text-primary"
            )}
          >
            {data.avatar_url ? (
              <img
                src={data.avatar_url}
                alt={data.first_name}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <User className="h-5 w-5" />
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="text-sm font-semibold truncate">
                {data.first_name}
                {data.last_name ? ` ${data.last_name}` : ""}
              </p>
              {data.isOwnerNode && (
                <Crown className="h-3 w-3 text-chart-5 flex-shrink-0" />
              )}
            </div>
            {data.maiden_name && (
              <p className="text-[10px] text-muted-foreground truncate">
                n&eacute;e {data.maiden_name}
              </p>
            )}
            {lifespan && (
              <p className="text-xs text-muted-foreground">{lifespan}</p>
            )}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2 !border-0" />
    </>
  );
}

export const MemberNode = memo(MemberNodeComponent);
