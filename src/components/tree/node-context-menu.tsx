"use client";

import { useEffect, useRef } from "react";
import {
  Pencil,
  Trash2,
  UserPlus,
  Heart,
  Info,
  ExternalLink,
} from "lucide-react";
import type { TreeMember } from "@/types";

interface NodeContextMenuProps {
  member: TreeMember;
  position: { x: number; y: number };
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddChild: () => void;
  onAddSpouse: () => void;
  onViewDetails: () => void;
  onViewProfile: () => void;
  onClose: () => void;
}

export function NodeContextMenu({
  member,
  position,
  canEdit,
  onEdit,
  onDelete,
  onAddChild,
  onAddSpouse,
  onViewDetails,
  onViewProfile,
  onClose,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const items: Array<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    variant?: "destructive";
    show: boolean;
  }> = [
    {
      label: "Edit Member",
      icon: <Pencil className="h-4 w-4" />,
      onClick: onEdit,
      show: canEdit,
    },
    {
      label: "Delete Member",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: onDelete,
      variant: "destructive",
      show: canEdit,
    },
  ];

  const addItems = [
    {
      label: "Add Child",
      icon: <UserPlus className="h-4 w-4" />,
      onClick: onAddChild,
      show: canEdit,
    },
    {
      label: "Add Spouse",
      icon: <Heart className="h-4 w-4" />,
      onClick: onAddSpouse,
      show: canEdit,
    },
  ];

  const viewItems = [
    {
      label: "View Details",
      icon: <Info className="h-4 w-4" />,
      onClick: onViewDetails,
      show: true,
    },
    {
      label: "View Full Profile",
      icon: <ExternalLink className="h-4 w-4" />,
      onClick: onViewProfile,
      show: true,
    },
  ];

  const visibleItems = items.filter((i) => i.show);
  const visibleAddItems = addItems.filter((i) => i.show);
  const visibleViewItems = viewItems.filter((i) => i.show);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] glass-card glass-elevated glass-edge-top rounded-md p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ left: position.x, top: position.y }}
    >
      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground truncate max-w-[200px]">
        {member.first_name} {member.last_name ?? ""}
      </div>
      <div className="-mx-1 my-1 h-px bg-border" />

      {visibleItems.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.onClick(); onClose(); }}
          className={`relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground ${
            item.variant === "destructive"
              ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
              : ""
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}

      {visibleAddItems.length > 0 && (
        <>
          <div className="-mx-1 my-1 h-px bg-border" />
          {visibleAddItems.map((item) => (
            <button
              key={item.label}
              onClick={() => { item.onClick(); onClose(); }}
              className="relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </>
      )}

      <div className="-mx-1 my-1 h-px bg-border" />
      {visibleViewItems.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.onClick(); onClose(); }}
          className="relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
