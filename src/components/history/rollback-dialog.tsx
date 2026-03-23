"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface RollbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: TreeSnapshot | null;
  loading: boolean;
  onConfirm: () => void;
}

export function RollbackDialog({
  open,
  onOpenChange,
  snapshot,
  loading,
  onConfirm,
}: RollbackDialogProps) {
  if (!snapshot) return null;

  const memberCount = snapshot.snapshot_data?.members?.length ?? 0;
  const relationshipCount =
    snapshot.snapshot_data?.relationships?.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-elevated border-white/10">
        <DialogHeader>
          <DialogTitle>Restore Snapshot</DialogTitle>
          <DialogDescription>
            This will replace all current tree data with the snapshot from{" "}
            <strong>{formatDate(snapshot.created_at)}</strong>. This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm font-medium">
              {snapshot.description || "Untitled snapshot"}
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {memberCount} member{memberCount !== 1 ? "s" : ""}
              </Badge>
              <Badge variant="secondary">
                {relationshipCount} relationship
                {relationshipCount !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>

          <p className="text-sm text-destructive font-medium">
            Warning: All current members and relationships will be deleted and
            replaced with the snapshot data. Consider creating a new snapshot
            first.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Restoring..." : "Restore Snapshot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
