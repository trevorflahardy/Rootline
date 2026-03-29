"use client";

import { useEffect } from "react";
import type { TreeMember } from "@/types";

interface UseTreeKeyboardParams {
  canEdit: boolean;
  selectedMemberId: string | null;
  selectedNodeIds: Set<string>;
  members: TreeMember[];
  contextMenu: { memberId: string; x: number; y: number } | null;
  closeContextMenu: () => void;
  clearSelection: () => void;
  undo: () => void;
  redo: () => void;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteTarget: React.Dispatch<React.SetStateAction<TreeMember | null>>;
  setBulkDeleteTargets: React.Dispatch<React.SetStateAction<TreeMember[] | null>>;
}

export function useTreeKeyboard({
  canEdit,
  selectedMemberId,
  selectedNodeIds,
  members,
  contextMenu,
  closeContextMenu,
  clearSelection,
  undo,
  redo,
  setShowSearch,
  setDeleteTarget,
  setBulkDeleteTargets,
}: UseTreeKeyboardParams) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "z") ||
        ((e.metaKey || e.ctrlKey) && e.key === "y")
      ) {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && canEdit) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
          return;
        if (selectedNodeIds.size > 1) {
          const targets = members.filter((m) => selectedNodeIds.has(m.id));
          if (targets.length > 0) setBulkDeleteTargets(targets);
        } else if (selectedMemberId) {
          const member = members.find((m) => m.id === selectedMemberId);
          if (member) setDeleteTarget(member);
        }
        return;
      }
      if (e.key === "Escape") {
        if (contextMenu) {
          closeContextMenu();
        } else {
          clearSelection();
        }
        return;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    clearSelection,
    undo,
    redo,
    canEdit,
    selectedMemberId,
    selectedNodeIds,
    members,
    contextMenu,
    closeContextMenu,
    setShowSearch,
    setDeleteTarget,
    setBulkDeleteTargets,
  ]);
}
