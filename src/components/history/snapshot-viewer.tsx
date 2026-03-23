"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TreeSnapshot } from "@/lib/actions/audit";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface SnapshotViewerProps {
  snapshots: TreeSnapshot[];
  isOwner: boolean;
  onRollback: (snapshot: TreeSnapshot) => void;
}

export function SnapshotViewer({
  snapshots,
  isOwner,
  onRollback,
}: SnapshotViewerProps) {
  if (snapshots.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No snapshots yet.</p>
        <p className="text-sm mt-1">
          Create a snapshot to save the current state of your tree.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {snapshots.map((snapshot) => {
        const memberCount = snapshot.snapshot_data?.members?.length ?? 0;
        const relationshipCount =
          snapshot.snapshot_data?.relationships?.length ?? 0;

        return (
          <Card key={snapshot.id} className="glass-card glass-edge-top border-white/10 transition-transform duration-200 hover:scale-[1.01]">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-medium">
                  {snapshot.description || "Untitled snapshot"}
                </CardTitle>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(snapshot.created_at)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {memberCount} member{memberCount !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="secondary">
                    {relationshipCount} relationship
                    {relationshipCount !== 1 ? "s" : ""}
                  </Badge>
                </div>
                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRollback(snapshot)}
                  >
                    Restore
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
