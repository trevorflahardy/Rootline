"use client";

import { useCallback, useState } from "react";
import type { Node, NodeMouseHandler } from "@xyflow/react";

interface ContextMenuState {
  memberId: string;
  x: number;
  y: number;
}

export function useTreeContextMenu() {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleNodeContextMenu: NodeMouseHandler = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (node.type === "coupleBlock") return;
      setContextMenu({
        memberId: node.id,
        x: event.clientX,
        y: event.clientY,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return {
    contextMenu,
    setContextMenu,
    handleNodeContextMenu,
    closeContextMenu,
  };
}
