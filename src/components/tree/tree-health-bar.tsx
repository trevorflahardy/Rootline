"use client";

import { useEffect, useState, useTransition } from "react";
import { getTreeHealth, type TreeHealthData } from "@/lib/actions/tree-health";

interface TreeHealthBarProps {
  treeId: string;
}

export function TreeHealthBar({ treeId }: TreeHealthBarProps) {
  const [health, setHealth] = useState<TreeHealthData | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const data = await getTreeHealth(treeId);
        setHealth(data);
      } catch {
        // Silently fail — health bar is non-critical UI
      }
    });
  }, [treeId]);

  if (!health || health.totalMembers === 0) return null;

  return (
    <div className="glass-card glass-light px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground/70">
          Tree Health
        </span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {health.completeMembers}/{health.totalMembers}
          </span>
          {health.newToday > 0 && (
            <span className="text-success tabular-nums font-medium">
              +{health.newToday}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar with percentage label */}
      <div className="space-y-1">
        <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${health.percentage}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0%</span>
          <span className="font-semibold text-foreground tabular-nums">{health.percentage}%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
