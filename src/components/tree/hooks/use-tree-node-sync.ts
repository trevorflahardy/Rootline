"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnNodesChange,
} from "@xyflow/react";
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  type CoParentGroup,
  type LayoutNode,
  type LayoutEdge,
} from "@/lib/utils/tree-layout";
import { saveMemberPositions } from "@/lib/actions/member";
import type { RelationshipEdgeData } from "../relationship-edge";
import type { CoupleBlockNodeData } from "../couple-block-node";

const BLOCK_PADDING = 18;

function buildCoupleBlockNode(
  group: CoParentGroup,
  p1: Node,
  p2: Node,
  joinEnabled: boolean,
  onToggle: (arcId: string) => void
): Node {
  const p1W = (p1.measured as { width?: number } | undefined)?.width ?? NODE_WIDTH;
  const p1H = (p1.measured as { height?: number } | undefined)?.height ?? NODE_HEIGHT;
  const p2W = (p2.measured as { width?: number } | undefined)?.width ?? NODE_WIDTH;
  const p2H = (p2.measured as { height?: number } | undefined)?.height ?? NODE_HEIGHT;
  const left = Math.min(p1.position.x, p2.position.x) - BLOCK_PADDING;
  const top = Math.min(p1.position.y, p2.position.y) - BLOCK_PADDING;
  const right = Math.max(p1.position.x + p1W, p2.position.x + p2W) + BLOCK_PADDING;
  const bottom = Math.max(p1.position.y + p1H, p2.position.y + p2H) + BLOCK_PADDING;
  return {
    id: `block-${group.arcId}`,
    type: "coupleBlock",
    position: { x: left, y: top },
    width: right - left,
    height: bottom - top,
    zIndex: -1,
    selectable: false,
    draggable: false,
    data: {
      parent1Id: group.parent1Id,
      parent2Id: group.parent2Id,
      arcId: group.arcId,
      joinEnabled,
      onToggle,
    } as CoupleBlockNodeData,
  };
}

interface UseTreeNodeSyncParams {
  treeId: string;
  canEdit: boolean;
  memberCount: number;
  initialNodes: Node[];
  initialEdges: Edge[];
  layout: { nodes: LayoutNode[]; edges: LayoutEdge[]; coParentGroups: CoParentGroup[] };
  joinEnabledMap: Record<string, boolean>;
  setJoinEnabledMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  pendingViewportCenterRef: React.MutableRefObject<{ x: number; y: number } | null>;
}

export function useTreeNodeSync({
  treeId,
  canEdit,
  memberCount,
  initialNodes,
  initialEdges,
  layout,
  joinEnabledMap,
  setJoinEnabledMap,
  pendingViewportCenterRef,
}: UseTreeNodeSyncParams) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const nodesRef = useRef<Node[]>([]);
  const hasInitialized = useRef(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMemberSigRef = useRef<string>("");

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  const handleToggleJoin = useCallback(
    (arcId: string) => {
      setJoinEnabledMap((prev) => {
        const next = { ...prev, [arcId]: !(prev[arcId] ?? true) };
        try {
          localStorage.setItem(`rootline-join-${treeId}`, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [treeId, setJoinEnabledMap]
  );

  // Couple block sync
  useEffect(() => {
    if (layout.coParentGroups.length === 0) {
      setNodes((nds) => {
        if (!nds.some((n) => n.type === "coupleBlock")) return nds;
        return nds.filter((n) => n.type !== "coupleBlock");
      });
      prevMemberSigRef.current = "";
      return;
    }

    const sig =
      nodes
        .filter((n) => n.type === "member")
        .map((n) => `${n.id}:${Math.round(n.position.x)}:${Math.round(n.position.y)}`)
        .sort()
        .join("|") +
      "||" +
      layout.coParentGroups.map((g) => `${g.arcId}:${joinEnabledMap[g.arcId] ?? true}`).join("|");

    if (sig === prevMemberSigRef.current) return;
    prevMemberSigRef.current = sig;

    setNodes((nds) => {
      const memberMap = new Map(nds.filter((n) => n.type === "member").map((n) => [n.id, n]));
      const newBlocks = layout.coParentGroups
        .map((group) => {
          const p1 = memberMap.get(group.parent1Id);
          const p2 = memberMap.get(group.parent2Id);
          if (!p1 || !p2) return null;
          return buildCoupleBlockNode(
            group,
            p1,
            p2,
            joinEnabledMap[group.arcId] ?? true,
            handleToggleJoin
          );
        })
        .filter((b): b is Node => b !== null);
      return [...nds.filter((n) => n.type !== "coupleBlock"), ...newBlocks];
    });
  }, [nodes, layout.coParentGroups, joinEnabledMap, handleToggleJoin, setNodes]);

  // Merge initial nodes with current positions
  useEffect(() => {
    setNodes((currentNodes) => {
      const currentPositions = new Map(
        currentNodes.filter((n) => n.type === "member").map((n) => [n.id, n.position])
      );
      const coupleBlocks = currentNodes.filter((n) => n.type === "coupleBlock");
      const pendingCenter = pendingViewportCenterRef.current;
      let usedCenter = false;
      const result = initialNodes.map((n) => {
        const existing = currentPositions.get(n.id);
        if (existing) return { ...n, position: existing };
        if (pendingCenter) {
          usedCenter = true;
          return { ...n, position: { x: pendingCenter.x - 100, y: pendingCenter.y - 50 } };
        }
        return n;
      });
      if (usedCenter) pendingViewportCenterRef.current = null;
      return [...result, ...coupleBlocks];
    });
  }, [initialNodes, setNodes, pendingViewportCenterRef]);

  // Sync edges from layout
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Initial fitView
  useEffect(() => {
    if (memberCount > 0 && !hasInitialized.current) {
      hasInitialized.current = true;
      const timer = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100);
      return () => clearTimeout(timer);
    }
  }, [memberCount, fitView]);

  // Spouse edge direction fix
  useEffect(() => {
    setEdges((currentEdges) => {
      const nodeX = new Map(nodes.map((node) => [node.id, node.position.x]));
      let hasChanges = false;
      const updatedEdges = currentEdges.map((edge) => {
        if (edge.type !== "relationship") return edge;
        const relData = edge.data as RelationshipEdgeData | undefined;
        if (relData?.relationship_type !== "spouse") return edge;
        const sourceX = nodeX.get(edge.source);
        const targetX = nodeX.get(edge.target);
        if (sourceX == null || targetX == null) return edge;
        if (sourceX > targetX) {
          hasChanges = true;
          return {
            ...edge,
            source: edge.target,
            target: edge.source,
            sourceHandle: "right",
            targetHandle: "left",
          };
        }
        if (edge.sourceHandle !== "right" || edge.targetHandle !== "left") {
          hasChanges = true;
          return { ...edge, sourceHandle: "right", targetHandle: "left" };
        }
        return edge;
      });
      return hasChanges ? updatedEdges : currentEdges;
    });
  }, [nodes, setEdges]);

  const handleNodeDragStop = useCallback(() => {
    if (!canEdit) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      const positions = nodesRef.current
        .filter((n) => n.type === "member")
        .map((n) => ({
          id: n.id,
          position_x: Math.round(n.position.x),
          position_y: Math.round(n.position.y),
        }));
      saveMemberPositions(treeId, positions).catch(() => {});
    }, 500);
  }, [canEdit, treeId]);

  const handleAutoLayout = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const layoutNode = layout.nodes.find((ln) => ln.id === n.id);
        return layoutNode ? { ...n, position: layoutNode.position } : n;
      })
    );
    saveMemberPositions(
      treeId,
      layout.nodes.map((ln) => ({
        id: ln.id,
        position_x: Math.round(ln.position.x),
        position_y: Math.round(ln.position.y),
      }))
    ).catch(() => {});
    setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50);
  }, [layout.nodes, setNodes, treeId, fitView]);

  return {
    nodes,
    edges,
    nodesRef,
    setNodes,
    setEdges,
    onEdgesChange,
    handleNodesChange,
    handleNodeDragStop,
    handleAutoLayout,
  };
}
