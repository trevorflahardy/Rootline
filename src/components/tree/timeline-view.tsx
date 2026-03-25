"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Baby,
  Skull,
  Heart,
  HeartCrack,
  ChevronDown,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TimelineEvent, TimelineEventType } from "@/types/timeline";

interface TimelineViewProps {
  events: TimelineEvent[];
  treeId: string;
  treeName: string;
}

const EVENT_TYPES: { value: TimelineEventType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "birth", label: "Birth" },
  { value: "death", label: "Death" },
  { value: "marriage", label: "Marriage" },
  { value: "divorce", label: "Divorce" },
];

const EVENT_META: Record<
  TimelineEventType,
  { icon: React.ElementType; color: string; label: string }
> = {
  birth: { icon: Baby, color: "text-green-600", label: "born" },
  death: { icon: Skull, color: "text-muted-foreground", label: "died" },
  marriage: { icon: Heart, color: "text-pink-500", label: "married" },
  divorce: { icon: HeartCrack, color: "text-orange-500", label: "divorced" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDecadeLabel(decade: number): string {
  return `${decade}s`;
}

function getDecadeOptions(events: TimelineEvent[]): number[] {
  const decades = Array.from(new Set(events.map((e) => e.decade))).sort(
    (a, b) => a - b
  );
  return decades;
}

export function TimelineView({ events, treeId, treeName }: TimelineViewProps) {
  const [activeType, setActiveType] = useState<TimelineEventType | "all">("all");
  const [decadeRange, setDecadeRange] = useState<string>("all");
  const [collapsedDecades, setCollapsedDecades] = useState<Set<number>>(
    new Set()
  );

  const allDecades = useMemo(() => getDecadeOptions(events), [events]);

  const filtered = useMemo(() => {
    let result = events;
    if (activeType !== "all") {
      result = result.filter((e) => e.type === activeType);
    }
    if (decadeRange !== "all") {
      const decade = parseInt(decadeRange, 10);
      result = result.filter((e) => e.decade === decade);
    }
    return result;
  }, [events, activeType, decadeRange]);

  const grouped = useMemo(() => {
    const map = new Map<number, TimelineEvent[]>();
    for (const event of filtered) {
      const existing = map.get(event.decade) ?? [];
      existing.push(event);
      map.set(event.decade, existing);
    }
    // Sort events within each decade by date
    for (const [decade, decadeEvents] of map.entries()) {
      map.set(
        decade,
        [...decadeEvents].sort((a, b) =>
          a.date < b.date ? -1 : a.date > b.date ? 1 : 0
        )
      );
    }
    // Return sorted decade keys
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [filtered]);

  const toggleDecade = (decade: number) => {
    setCollapsedDecades((prev) => {
      const next = new Set(prev);
      if (next.has(decade)) {
        next.delete(decade);
      } else {
        next.add(decade);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{treeName}</h1>
          <p className="text-sm text-muted-foreground">Family Timeline</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map(({ value, label }) => (
            <Badge
              key={value}
              variant={activeType === value ? "default" : "outline"}
              className="cursor-pointer select-none px-3 py-1 text-sm transition-colors"
              onClick={() => setActiveType(value)}
            >
              {label}
            </Badge>
          ))}
        </div>

        {allDecades.length > 1 && (
          <div className="ml-auto">
            <select
              value={decadeRange}
              onChange={(e) => setDecadeRange(e.target.value)}
              className="text-sm bg-transparent border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All decades</option>
              {allDecades.map((d) => (
                <option key={d} value={String(d)}>
                  {getDecadeLabel(d)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Timeline */}
      {grouped.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center gap-3">
          <Calendar className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground font-medium">No events match your filters</p>
          <p className="text-sm text-muted-foreground/60">
            Try selecting a different event type or decade range.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              setActiveType("all");
              setDecadeRange("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([decade, decadeEvents]) => {
            const isCollapsed = collapsedDecades.has(decade);
            return (
              <div key={decade} className="glass-card overflow-hidden">
                {/* Decade header */}
                <button
                  onClick={() => toggleDecade(decade)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-foreground/5 transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-semibold text-sm">
                    {getDecadeLabel(decade)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({decadeEvents.length}{" "}
                    {decadeEvents.length === 1 ? "event" : "events"})
                  </span>
                </button>

                {/* Events */}
                {!isCollapsed && (
                  <div className="px-4 pb-4 space-y-1">
                    <div className="border-l-2 border-border ml-1 pl-4 space-y-3">
                      {decadeEvents.map((event) => {
                        const meta = EVENT_META[event.type];
                        const Icon = meta.icon;
                        return (
                          <div
                            key={event.id}
                            className="flex items-start gap-3 group"
                          >
                            {/* Timeline dot */}
                            <div className="relative -ml-[1.3125rem] mt-0.5">
                              <div className="h-2.5 w-2.5 rounded-full border-2 border-border bg-background" />
                            </div>

                            {/* Icon */}
                            <Icon
                              className={`h-4 w-4 mt-0.5 shrink-0 ${meta.color}`}
                            />

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm">
                                <span className="text-muted-foreground shrink-0">
                                  {formatDate(event.date)}
                                </span>
                                <span className="text-muted-foreground">—</span>
                                <Link
                                  href={`/tree/${treeId}/member/${event.memberId}`}
                                  className="font-medium hover:underline underline-offset-2 text-foreground"
                                >
                                  {event.memberName}
                                </Link>
                                <span className="text-muted-foreground">
                                  {meta.label}
                                </span>
                                {event.relatedMemberName && (
                                  <>
                                    <span className="text-muted-foreground">
                                      {event.type === "divorce"
                                        ? "from"
                                        : "to"}
                                    </span>
                                    {event.relatedMemberId ? (
                                      <Link
                                        href={`/tree/${treeId}/member/${event.relatedMemberId}`}
                                        className="font-medium hover:underline underline-offset-2 text-foreground"
                                      >
                                        {event.relatedMemberName}
                                      </Link>
                                    ) : (
                                      <span className="font-medium">
                                        {event.relatedMemberName}
                                      </span>
                                    )}
                                  </>
                                )}
                                {event.place && (
                                  <span className="text-muted-foreground/70">
                                    in {event.place}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
