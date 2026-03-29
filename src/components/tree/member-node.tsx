"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { User, Crown, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatLifespan } from "@/lib/utils/date";
import type { TreeMember } from "@/types";
import type { NodeProfileLink } from "@/lib/actions/permissions";

export type MemberNodeData = TreeMember & {
  isSelected?: boolean;
  highlightVariant?: "none" | "path" | "descendant";
  isOwnerNode?: boolean;
  linkedProfile?: NodeProfileLink | null;
  remoteSelection?: {
    userId: string;
    name: string;
    color: string;
    avatarUrl?: string | null;
  } | null;
  [key: string]: unknown;
};

function MemberNodeComponent({ data }: NodeProps & { data: MemberNodeData }) {
  const [hovered, setHovered] = useState(false);
  const lifespan = formatLifespan(data.date_of_birth, data.date_of_death, data.is_deceased);
  const visualState = data.isSelected
    ? "selected"
    : data.highlightVariant === "path"
      ? "path"
      : data.highlightVariant === "descendant"
        ? "descendant"
        : "none";
  const hasRemoteSelection = Boolean(data.remoteSelection) && !data.isSelected;
  // Prefer linked Clerk profile avatar over the member's own avatar
  const displayAvatar = data.linkedProfile?.avatarUrl ?? data.avatar_url;

  const handleColor =
    visualState === "selected" || visualState === "path"
      ? "oklch(0.45 0.18 155)"
      : visualState === "descendant"
        ? "oklch(0.62 0.12 210)"
        : "oklch(0.75 0 0)";

  return (
    <>
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="h-1.5! min-h-0! w-1.5! min-w-0! rounded-full! border-0!"
        style={{ background: handleColor }}
      />
      {/* Left handle — target for incoming spouse connections */}
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        className="h-2.5! min-h-0! w-2.5! min-w-0! rounded-full! border-2! border-solid! transition-opacity duration-150"
        style={{ background: "transparent", borderColor: handleColor, opacity: hovered ? 1 : 0 }}
        title="Connect as spouse"
      />

      <div
        role="treeitem"
        aria-selected={data.isSelected ?? false}
        aria-label={`${data.first_name}${data.last_name ? ` ${data.last_name}` : ""}`}
        tabIndex={0}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "glass-card glass-edge-top max-w-50 min-w-40 cursor-pointer rounded-2xl px-4 py-3 transition-all duration-200 hover:bg-(--glass-bg-heavy)",
          data.is_deceased && "opacity-70",
          visualState === "selected" && "border-primary scale-105 border-2 transition-transform",
          visualState === "path" && "shadow-[0_0_20px_rgba(34,197,94,0.4)]",
          visualState === "descendant" && "border-primary/30 shadow-primary/10 shadow-md",
          hasRemoteSelection && "border shadow-sm"
        )}
        style={
          hasRemoteSelection
            ? {
                borderColor: `${data.remoteSelection?.color ?? "#94a3b8"}88`,
                boxShadow: `0 0 0 1px ${data.remoteSelection?.color ?? "#94a3b8"}55`,
              }
            : undefined
        }
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                data.is_deceased
                  ? "bg-muted text-muted-foreground grayscale"
                  : visualState === "selected" || visualState === "path"
                    ? "bg-[oklch(0.45_0.18_155/0.12)] text-[oklch(0.4_0.15_155)]"
                    : visualState === "descendant"
                      ? "bg-[oklch(0.62_0.12_210/0.14)] text-[oklch(0.5_0.1_210)]"
                      : "bg-muted text-muted-foreground"
              )}
            >
              {displayAvatar ? (
                <Image
                  src={displayAvatar}
                  alt={data.first_name}
                  className="h-10 w-10 rounded-full object-cover"
                  width={40}
                  height={40}
                />
              ) : (
                <User className="h-5 w-5" />
              )}
            </div>
            {data.linkedProfile && (
              <div
                className="ring-primary/20 absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 ring-2"
                title={`Linked to ${data.linkedProfile.displayName}`}
              >
                <UserCheck className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="text-foreground truncate text-sm font-semibold">
                {data.first_name}
                {data.last_name ? ` ${data.last_name}` : ""}
              </p>
              {data.isOwnerNode && <Crown className="text-primary h-3 w-3 shrink-0" />}
            </div>
            {data.maiden_name && (
              <p className="text-muted-foreground truncate text-[10px]">
                n&eacute;e {data.maiden_name}
              </p>
            )}
            {lifespan && <p className="text-muted-foreground text-xs">{lifespan}</p>}
          </div>
        </div>

        {hasRemoteSelection && data.remoteSelection && (
          <div
            className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: `${data.remoteSelection.color}22`,
              color: data.remoteSelection.color,
            }}
          >
            Viewing: {data.remoteSelection.name}
          </div>
        )}
      </div>

      {/* Right handle — source for outgoing spouse connections */}
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="h-2.5! min-h-0! w-2.5! min-w-0! rounded-full! border-2! border-solid! transition-opacity duration-150"
        style={{ background: "transparent", borderColor: handleColor, opacity: hovered ? 1 : 0 }}
        title="Connect as spouse"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="h-1.5! min-h-0! w-1.5! min-w-0! rounded-full! border-0!"
        style={{ background: handleColor }}
      />
    </>
  );
}

export const MemberNode = memo(MemberNodeComponent);
