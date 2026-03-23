"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuditTimeline } from "@/components/history/audit-timeline";
import { SnapshotViewer } from "@/components/history/snapshot-viewer";
import { RollbackDialog } from "@/components/history/rollback-dialog";
import {
  getAuditLog,
  createSnapshot,
  rollbackToSnapshot,
} from "@/lib/actions/audit";
import type { AuditLogEntry, TreeSnapshot } from "@/lib/actions/audit";

interface HistoryClientProps {
  treeId: string;
  treeName: string;
  isOwner: boolean;
  canEdit: boolean;
  initialEntries: AuditLogEntry[];
  initialTotal: number;
  initialSnapshots: TreeSnapshot[];
}

export function HistoryClient({
  treeId,
  treeName,
  isOwner,
  canEdit,
  initialEntries,
  initialTotal,
  initialSnapshots,
}: HistoryClientProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [total, setTotal] = useState(initialTotal);
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [page, setPage] = useState(1);
  const [description, setDescription] = useState("");
  const [showCreateSnapshot, setShowCreateSnapshot] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<TreeSnapshot | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const [isRollingBack, startRollbackTransition] = useTransition();

  const pageSize = 50;

  function handlePageChange(newPage: number) {
    startTransition(async () => {
      const result = await getAuditLog(treeId, {
        page: newPage,
        pageSize,
      });
      setEntries(result.entries);
      setTotal(result.total);
      setPage(newPage);
    });
  }

  function handleCreateSnapshot() {
    startTransition(async () => {
      const snapshot = await createSnapshot(treeId, description);
      setSnapshots((prev) => [snapshot, ...prev]);
      setDescription("");
      setShowCreateSnapshot(false);
    });
  }

  function handleRollback() {
    if (!rollbackTarget) return;
    const snapshotId = rollbackTarget.id;
    startRollbackTransition(async () => {
      await rollbackToSnapshot(treeId, snapshotId);
      setRollbackTarget(null);
      // Refresh audit log after rollback
      const result = await getAuditLog(treeId, { page: 1, pageSize });
      setEntries(result.entries);
      setTotal(result.total);
      setPage(1);
    });
  }

  return (
    <div className="flex-1 min-h-screen">
      <div className="glass-card glass-edge-top px-4 py-3 mx-4 mt-4 rounded-xl">
        <h1 className="font-semibold text-lg">History</h1>
        <p className="text-sm text-muted-foreground">{treeName}</p>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-8">
        {/* Snapshots Section */}
        <Card className="glass-card glass-edge-top border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Snapshots</CardTitle>
              {canEdit && (
                <Button
                  size="sm"
                  variant={showCreateSnapshot ? "outline" : "default"}
                  onClick={() => setShowCreateSnapshot(!showCreateSnapshot)}
                >
                  {showCreateSnapshot ? "Cancel" : "Create Snapshot"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showCreateSnapshot && (
              <div className="mb-4 space-y-3 rounded-md border p-4">
                <label
                  htmlFor="snapshot-description"
                  className="text-sm font-medium"
                >
                  Description
                </label>
                <input
                  id="snapshot-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Before adding grandparents"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Button
                  size="sm"
                  onClick={handleCreateSnapshot}
                  disabled={isPending}
                >
                  {isPending ? "Saving..." : "Save Snapshot"}
                </Button>
              </div>
            )}
            <SnapshotViewer
              snapshots={snapshots}
              isOwner={isOwner}
              onRollback={(snapshot) => setRollbackTarget(snapshot)}
            />
          </CardContent>
        </Card>

        {/* Audit Log Section */}
        <Card className="glass-card glass-edge-top border-white/10">
          <CardHeader>
            <CardTitle>Change Log</CardTitle>
          </CardHeader>
          <CardContent>
            <AuditTimeline
              entries={entries}
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={handlePageChange}
            />
          </CardContent>
        </Card>
      </div>

      <RollbackDialog
        open={rollbackTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRollbackTarget(null);
        }}
        snapshot={rollbackTarget}
        loading={isRollingBack}
        onConfirm={handleRollback}
      />
    </div>
  );
}
