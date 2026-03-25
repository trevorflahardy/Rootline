"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, BarChart3 } from "lucide-react";
import { getTreeStats, type TreeStats } from "@/lib/actions/tree-stats";

interface TreeStatsProps {
  treeId: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TreeStats({ treeId }: TreeStatsProps) {
  const [stats, setStats] = useState<TreeStats | null>(null);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const data = await getTreeStats(treeId);
        setStats(data);
      } catch {
        // Silently fail — stats panel is non-critical UI
      }
    });
  }, [treeId]);

  if (!stats || stats.totalMembers === 0) return null;

  const { fieldBreakdown, genderCounts } = stats;
  const dobPct =
    stats.totalMembers > 0
      ? Math.round((fieldBreakdown.withDob / stats.totalMembers) * 100)
      : 0;
  const bioPct =
    stats.totalMembers > 0
      ? Math.round((fieldBreakdown.withBio / stats.totalMembers) * 100)
      : 0;
  const photoPct =
    stats.totalMembers > 0
      ? Math.round((fieldBreakdown.withPhoto / stats.totalMembers) * 100)
      : 0;

  return (
    <div className="glass-card glass-light px-3 py-2.5 space-y-2">
      {/* Header / toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full"
      >
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground/70">
          <BarChart3 className="h-3.5 w-3.5" />
          Tree Statistics
        </span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          {/* Members */}
          <div className="col-span-2 rounded-lg bg-muted/30 px-2.5 py-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
              Members
            </p>
            <p className="text-xs text-foreground">
              <span className="font-semibold tabular-nums">
                {stats.totalMembers}
              </span>{" "}
              total &middot;{" "}
              <span className="tabular-nums">{stats.livingMembers}</span> living
              &middot;{" "}
              <span className="tabular-nums">{stats.deceasedMembers}</span>{" "}
              deceased
            </p>
          </div>

          {/* Generations */}
          <div className="rounded-lg bg-muted/30 px-2.5 py-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
              Generations
            </p>
            <p className="text-xs font-semibold text-foreground tabular-nums">
              {stats.maxGenerations} deep
            </p>
          </div>

          {/* Avg lifespan */}
          {stats.averageLifespanYears !== null && (
            <div className="rounded-lg bg-muted/30 px-2.5 py-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                Avg Lifespan
              </p>
              <p className="text-xs font-semibold text-foreground tabular-nums">
                {stats.averageLifespanYears} yrs
              </p>
            </div>
          )}

          {/* Oldest living */}
          {stats.oldestLivingMember && (
            <div className="col-span-2 rounded-lg bg-muted/30 px-2.5 py-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                Oldest Living
              </p>
              <Link
                href={`/tree/${treeId}/member/${stats.oldestLivingMember.id}`}
                className="text-xs text-primary hover:underline"
              >
                {stats.oldestLivingMember.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                {", "}age {stats.oldestLivingMember.age}
              </span>
            </div>
          )}

          {/* Profile completeness */}
          <div className="col-span-2 rounded-lg bg-muted/30 px-2.5 py-1.5 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Completeness
              </p>
              <span className="text-[10px] font-semibold text-foreground tabular-nums">
                {stats.completenessPercent}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${stats.completenessPercent}%` }}
              />
            </div>
            {/* Field breakdown pills */}
            <div className="flex flex-wrap gap-1 pt-0.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                DOB {dobPct}%
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                Bio {bioPct}%
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                Photo {photoPct}%
              </span>
            </div>
          </div>

          {/* Gender split */}
          <div className="col-span-2 rounded-lg bg-muted/30 px-2.5 py-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
              Gender Split
            </p>
            <p className="text-xs text-foreground tabular-nums">
              ♂ {genderCounts.male} &middot; ♀ {genderCounts.female} &middot; ?{" "}
              {genderCounts.unknown + genderCounts.other}
            </p>
          </div>

          {/* Recently added */}
          {stats.mostRecentlyAdded && (
            <div className="col-span-2 rounded-lg bg-muted/30 px-2.5 py-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                Recently Added
              </p>
              <div className="flex items-center justify-between">
                <Link
                  href={`/tree/${treeId}/member/${stats.mostRecentlyAdded.id}`}
                  className="text-xs text-primary hover:underline truncate"
                >
                  {stats.mostRecentlyAdded.name}
                </Link>
                <span className="text-[10px] text-muted-foreground ml-1 shrink-0">
                  {formatDate(stats.mostRecentlyAdded.addedAt)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
