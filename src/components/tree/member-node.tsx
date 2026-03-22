"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { User, Crown, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatLifespan } from "@/lib/utils/date";
import type { TreeMember } from "@/types";
import type { NodeProfileLink } from "@/lib/actions/permissions";

export type MemberNodeData = TreeMember & {
  isSelected?: boolean;
  isPathHighlighted?: boolean;
  isOwnerNode?: boolean;
  linkedProfile?: NodeProfileLink | null;
  [key: string]: unknown;
};

function MemberNodeComponent({ data }: NodeProps & { data: MemberNodeData }) {
  const lifespan = formatLifespan(data.date_of_birth, data.date_of_death, data.is_deceased);
  const active = data.isSelected || data.isPathHighlighted;
  // Prefer linked Clerk profile avatar over the member's own avatar
  const displayAvatar = data.linkedProfile?.avatarUrl ?? data.avatar_url;

  const handleColor = active ? "oklch(0.45 0.18 155)" : "oklch(0.75 0 0)";

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-1.5 !h-1.5 !border-0 !rounded-full !min-w-0 !min-h-0"
        style={{ background: handleColor }}
      />

      <div
        className={cn(
          "rounded-xl border-[1.5px] bg-card shadow-sm px-4 py-3 min-w-[160px] max-w-[200px] transition-all duration-200 cursor-pointer",
          data.is_deceased && "opacity-70",
          // Default: gray border. Selected/highlighted: green border. No ring.
          active
            ? "border-[oklch(0.45_0.18_155)]"
            : "border-border",
          // Subtle shadow on path highlight
          data.isPathHighlighted && "shadow-md shadow-[oklch(0.5_0.18_155_/_0.12)]",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className={cn(
                "h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold",
                data.is_deceased
                  ? "bg-muted text-muted-foreground grayscale"
                  : active
                    ? "bg-[oklch(0.45_0.18_155_/_0.12)] text-[oklch(0.4_0.15_155)]"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={data.first_name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <User className="h-5 w-5" />
              )}
            </div>
            {data.linkedProfile && (
              <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center ring-2 ring-card" title={`Linked to ${data.linkedProfile.displayName}`}>
                <UserCheck className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </div>

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

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-1.5 !h-1.5 !border-0 !rounded-full !min-w-0 !min-h-0"
        style={{ background: handleColor }}
      />
    </>
  );
}

export const MemberNode = memo(MemberNodeComponent);
