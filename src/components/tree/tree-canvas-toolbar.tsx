"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { MousePointer2, Undo2, Redo2, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteMember } from "@/lib/actions/member";
import type { UndoableAction } from "@/lib/hooks/use-undo-redo";
import type { TreeMember } from "@/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import type { CollaboratorPresence, CollaboratorCursor } from "./hooks/use-tree-realtime";

interface UndoRedoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
  onUndo: () => void;
  onRedo: () => void;
}

export function UndoRedoControls({
  canUndo,
  canRedo,
  undoDescription,
  redoDescription,
  onUndo,
  onRedo,
}: UndoRedoControlsProps) {
  if (!canUndo && !canRedo) return null;

  return (
    <div
      className="glass-card glass-light absolute top-4 right-4 z-10 flex items-center gap-1 rounded-xl p-1.5"
      data-export-exclude
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{canUndo ? `Undo: ${undoDescription}` : "Nothing to undo"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={!canRedo}
            onClick={onRedo}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{canRedo ? `Redo: ${redoDescription}` : "Nothing to redo"}</TooltipContent>
      </Tooltip>
    </div>
  );
}

interface BulkActionBarProps {
  selectedCount: number;
  canEdit: boolean;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

export function BulkActionBar({
  selectedCount,
  canEdit,
  onBulkDelete,
  onClearSelection,
}: BulkActionBarProps) {
  if (selectedCount <= 1) return null;

  return (
    <div
      className="glass-card glass-light absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-2"
      data-export-exclude
    >
      <span className="text-sm font-medium">{selectedCount} selected</span>
      {canEdit && (
        <Button variant="destructive" size="sm" onClick={onBulkDelete}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete Selected
        </Button>
      )}
      <button
        onClick={onClearSelection}
        className="text-muted-foreground hover:text-foreground text-xs transition-colors"
      >
        Clear
      </button>
    </div>
  );
}

interface RelationshipLabelBarProps {
  label: string | null;
  visible: boolean;
  onClear: () => void;
}

export function RelationshipLabelBar({ label, visible, onClear }: RelationshipLabelBarProps) {
  if (!label || !visible) return null;

  return (
    <div
      className="glass-card glass-light absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-2"
      data-export-exclude
    >
      <span className="text-sm font-medium">{label}</span>
      <button
        onClick={onClear}
        className="text-muted-foreground hover:text-foreground text-xs transition-colors"
      >
        Clear
      </button>
    </div>
  );
}

interface RemoteCursorsOverlayProps {
  remoteCursors: Record<string, CollaboratorCursor>;
  remoteCollaborators: Record<string, CollaboratorPresence>;
}

export function RemoteCursorsOverlay({
  remoteCursors,
  remoteCollaborators,
}: RemoteCursorsOverlayProps) {
  return (
    <>
      {Object.entries(remoteCursors).map(([userId, cursor]) => {
        if (cursor.x < -100 || cursor.y < -100) return null;
        const collaborator = remoteCollaborators[userId];
        if (!collaborator) return null;
        if (collaborator.selectedMemberId) return null;

        return (
          <div
            key={`cursor-${userId}`}
            className="pointer-events-none absolute z-30"
            style={{ left: cursor.x, top: cursor.y, transform: "translate(-2px, -2px)" }}
          >
            <MousePointer2
              className="h-4 w-4"
              style={{ color: collaborator.color, fill: collaborator.color }}
            />
            <div
              className="glass-card glass-light mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium"
              style={{ borderColor: `${collaborator.color}88`, borderWidth: 1 }}
            >
              {collaborator.avatarUrl ? (
                <Image
                  src={collaborator.avatarUrl}
                  alt={collaborator.name}
                  width={14}
                  height={14}
                  className="h-3.5 w-3.5 rounded-full object-cover"
                />
              ) : (
                <span
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px]"
                  style={{ backgroundColor: `${collaborator.color}33`, color: collaborator.color }}
                >
                  {collaborator.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span>{collaborator.name}</span>
            </div>
          </div>
        );
      })}
    </>
  );
}

interface DeleteMemberDialogsProps {
  treeId: string;
  deleteTarget: TreeMember | null;
  bulkDeleteTargets: TreeMember[] | null;
  setDeleteTarget: React.Dispatch<React.SetStateAction<TreeMember | null>>;
  setBulkDeleteTargets: React.Dispatch<React.SetStateAction<TreeMember[] | null>>;
  setSelectedMemberId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  pushUndo: (action: UndoableAction) => Promise<void>;
}

export function DeleteMemberDialogs({
  treeId,
  deleteTarget,
  bulkDeleteTargets,
  setDeleteTarget,
  setBulkDeleteTargets,
  setSelectedMemberId,
  setSelectedNodeIds,
  pushUndo,
}: DeleteMemberDialogsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const memberToDelete = deleteTarget;
    try {
      await pushUndo({
        type: "delete_member",
        description: `Delete ${memberToDelete.first_name} ${memberToDelete.last_name ?? ""}`.trim(),
        execute: async () => {
          await deleteMember(memberToDelete.id, treeId);
        },
        undo: async () => {
          toast.info("Undo not available for delete — refresh to see current state");
          router.refresh();
        },
      });
      toast.success(`${memberToDelete.first_name} removed`);
      setDeleteTarget(null);
      setSelectedMemberId(null);
      router.refresh();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, pushUndo, treeId, router, setDeleteTarget, setSelectedMemberId]);

  const handleBulkDeleteConfirm = useCallback(async () => {
    if (!bulkDeleteTargets) return;
    setDeleting(true);
    try {
      for (const member of bulkDeleteTargets) {
        await deleteMember(member.id, treeId);
      }
      toast.success(`${bulkDeleteTargets.length} members removed`);
      setBulkDeleteTargets(null);
      setSelectedMemberId(null);
      setSelectedNodeIds(new Set());
      router.refresh();
    } catch {
      toast.error("Failed to delete some members");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }, [
    bulkDeleteTargets,
    treeId,
    router,
    setBulkDeleteTargets,
    setSelectedMemberId,
    setSelectedNodeIds,
  ]);

  return (
    <>
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete member?"
        description={`This will permanently remove ${deleteTarget?.first_name ?? ""} ${deleteTarget?.last_name ?? ""} and all their relationships from the tree.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDeleteConfirm}
      />
      <ConfirmDialog
        open={!!bulkDeleteTargets}
        onOpenChange={() => setBulkDeleteTargets(null)}
        title={`Delete ${bulkDeleteTargets?.length ?? 0} members?`}
        description="This will permanently remove the selected members and all their relationships from the tree."
        confirmLabel="Delete All"
        destructive
        loading={deleting}
        onConfirm={handleBulkDeleteConfirm}
      />
    </>
  );
}
