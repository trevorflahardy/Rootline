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
    <div className="glass-card glass-edge-top px-4 py-3 flex items-center gap-4 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium text-foreground/80 whitespace-nowrap">
          Tree Health
        </span>
        <span className="font-semibold text-foreground tabular-nums">
          {health.percentage}%
        </span>
      </div>

      {/* Progress track */}
      <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${health.percentage}%` }}
        />
      </div>

      <div className="flex items-center gap-3 text-muted-foreground whitespace-nowrap">
        <span className="tabular-nums">
          {health.completeMembers}/{health.totalMembers} complete
        </span>
        {health.newToday > 0 && (
          <span className="text-success tabular-nums">
            +{health.newToday} today
          </span>
        )}
      </div>
    </div>
  );
}
