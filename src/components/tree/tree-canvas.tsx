"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type Connection,
  type OnConnectStart,
  type OnConnectEnd,
  type OnNodesChange,
  type NodeMouseHandler,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import Image from "next/image";
import { MousePointer2, Undo2, Redo2, Trash2 } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { computeTreeLayout } from "@/lib/utils/tree-layout";
import { findPath, getPathRelationshipIds } from "@/lib/utils/path-finder";
import { calculateRelationship } from "@/lib/utils/relationship-calculator";
import { deleteMember, saveMemberPositions } from "@/lib/actions/member";
import { createRelationship } from "@/lib/actions/relationship";
import { createBrowserClient } from "@/lib/supabase/client";
import { useUndoRedo } from "@/lib/hooks/use-undo-redo";
import { MemberNode, type MemberNodeData } from "./member-node";
import { RelationshipEdge, type EdgeHighlightMode, type RelationshipEdgeData } from "./relationship-edge";
import { FamilyArcEdge, type FamilyArcEdgeData } from "./family-arc-edge";
import { NodeContextMenu } from "./node-context-menu";
import { TreeToolbar } from "./tree-toolbar";
import { MemberDetailPanel } from "./member-detail-panel";
import { AddMemberDialog } from "./add-member-dialog";
import { AddRelationshipDialog } from "./add-relationship-dialog";
import { EditMemberDialog } from "./edit-member-dialog";
import { TreeSearch } from "./tree-search";
import { GedcomImportDialog } from "@/components/import-export/gedcom-import-dialog";
import type { TreeMember, Relationship, FamilyTree } from "@/types";
import { canEditMember as checkCanEditMember, type NodeProfileLink, type TreePermissions } from "@/lib/actions/permissions";

const nodeTypes: NodeTypes = {
  member: MemberNode as unknown as NodeTypes["member"],
};

const edgeTypes: EdgeTypes = {
  relationship: RelationshipEdge as unknown as EdgeTypes["relationship"],
  "family-arc": FamilyArcEdge as unknown as EdgeTypes["family-arc"],
};

interface TreeCanvasProps {
  tree: FamilyTree;
  members: TreeMember[];
  relationships: Relationship[];
  descendantHighlightDepth?: number;
  canEdit: boolean;
  currentUserId: string;
  currentUserName?: string | null;
  currentUserAvatarUrl?: string | null;
  nodeProfileMap?: Record<string, NodeProfileLink>;
  permissions?: TreePermissions;
}

type CollaboratorLock = {
  memberId: string;
  field: string;
};

type CollaboratorPresence = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  color: string;
  selectedMemberId: string | null;
  editingLock: CollaboratorLock | null;
};

type CollaboratorCursor = {
  userId: string;
  x: number;
  y: number;
  ts: number;
};

function colorFromUserId(userId: string): string {
  const palette = [
    "#22c55e",
    "#3b82f6",
    "#f59e0b",
    "#ef4444",
    "#06b6d4",
    "#f97316",
    "#10b981",
    "#8b5cf6",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

function TreeCanvasInner({
  tree,
  members: initialMembers,
  relationships: initialRelationships,
  descendantHighlightDepth = 1,
  canEdit,
  currentUserId,
  currentUserName,
  currentUserAvatarUrl,
  nodeProfileMap = {},
  permissions,
}: TreeCanvasProps) {
  const { fitView, setCenter, screenToFlowPosition } = useReactFlow();
  const router = useRouter();

  const canEditMember = useCallback(
    async (memberId: string): Promise<boolean> => {
      if (!canEdit) return false;
      if (permissions?.isOwner) return true;
      return checkCanEditMember(tree.id, memberId);
    },
    [canEdit, permissions?.isOwner, permissions?.linkedNodeId, tree.id]
  );

  const [members, setMembers] = useState(initialMembers);
  const [relationships, setRelationships] = useState(initialRelationships);

  // Sync with server data when props change (after router.refresh)
  useEffect(() => { setMembers(initialMembers); }, [initialMembers]);
  useEffect(() => { setRelationships(initialRelationships); }, [initialRelationships]);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [hoveredRelMemberId, setHoveredRelMemberId] = useState<string | null>(null);
  const [pathStart, setPathStart] = useState<string | null>(null);
  const [pathEnd, setPathEnd] = useState<string | null>(null);
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const [highlightedEdges, setHighlightedEdges] = useState<string[]>([]);
  const [relationshipLabel, setRelationshipLabel] = useState<string | null>(null);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addMemberDefaults, setAddMemberDefaults] = useState<{
    relatedMemberId: string;
    relationshipDirection: "parent" | "child" | "spouse";
  } | null>(null);
  const [showAddRelationshipDialog, setShowAddRelationshipDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [editingMember, setEditingMember] = useState<TreeMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TreeMember | null>(null);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<TreeMember[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [remoteCollaborators, setRemoteCollaborators] = useState<Record<string, CollaboratorPresence>>({});
  const [remoteCursors, setRemoteCursors] = useState<Record<string, CollaboratorCursor>>({});
  const [activeEditLock, setActiveEditLock] = useState<CollaboratorLock | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    memberId: string;
    x: number;
    y: number;
  } | null>(null);

  // Undo/redo
  const { push: pushUndo, undo, redo, canUndo, canRedo, undoDescription, redoDescription } = useUndoRedo();

  const normalizedDescendantHighlightDepth =
    Number.isFinite(descendantHighlightDepth)
      ? Math.min(10, Math.max(0, Math.trunc(descendantHighlightDepth)))
      : 1;

  // Track whether we've done the initial layout
  const hasInitialized = useRef(false);
  // Track pending position saves (debounced)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to track latest node positions (avoids setState-in-render)
  const nodesRef = useRef<Node[]>([]);
  // Viewport center to position new members near the user's current view
  const pendingViewportCenterRef = useRef<{ x: number; y: number } | null>(null);
  // Track connection start to support quick-add when a drag misses a target
  const pendingConnectStartRef = useRef<{ nodeId: string | null; handleId: string | null } | null>(null);
  // Realtime collaboration channel
  const collaborationChannelRef = useRef<ReturnType<ReturnType<typeof createBrowserClient>["channel"]> | null>(null);
  const cursorSentAtRef = useRef(0);
  const selfColor = useMemo(() => colorFromUserId(currentUserId || "anonymous"), [currentUserId]);
  const resolvedCurrentUserName = useMemo(() => currentUserName?.trim() || "You", [currentUserName]);

  // Compute layout from dagre
  const layout = useMemo(
    () => computeTreeLayout(members, relationships),
    [members, relationships]
  );

  // No default marker — each edge renders its own color-matched arrow
  const defaultEdgeOptions = useMemo(() => ({}), []);

  // Build initial nodes with saved positions or dagre layout positions
  const initialNodes: Node[] = useMemo(() => {
    return layout.nodes.map((n) => {
      const member = n.data as TreeMember;
      const hasSavedPosition = member.position_x != null && member.position_y != null;
      return {
        ...n,
        position: hasSavedPosition
          ? { x: member.position_x!, y: member.position_y! }
          : n.position,
        data: {
          ...n.data,
          isSelected: false,
          highlightVariant: "none",
          linkedProfile: nodeProfileMap[n.id] ?? null,
        } as MemberNodeData,
      };
    });
  }, [layout.nodes, nodeProfileMap]);

  const initialEdges: Edge[] = useMemo(() => {
    return layout.edges.map((e) => ({
      ...e,
      data: {
        ...e.data,
        highlightMode: "none",
      },
    }));
  }, [layout.edges]);

  const { selectedDescendantNodeIds, selectedDescendantEdgeIds } = useMemo(() => {
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();

    if (!selectedMemberId || normalizedDescendantHighlightDepth === 0) {
      return {
        selectedDescendantNodeIds: nodeIds,
        selectedDescendantEdgeIds: edgeIds,
      };
    }

    const queue: Array<{ id: string; depth: number }> = [{ id: selectedMemberId, depth: 0 }];
    const visited = new Set<string>([selectedMemberId]);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.depth >= normalizedDescendantHighlightDepth) {
        continue;
      }

      for (const rel of relationships) {
        if (
          rel.from_member_id === current.id
          && (rel.relationship_type === "parent_child" || rel.relationship_type === "adopted")
        ) {
          edgeIds.add(rel.id);
          nodeIds.add(rel.to_member_id);

          if (!visited.has(rel.to_member_id)) {
            visited.add(rel.to_member_id);
            queue.push({ id: rel.to_member_id, depth: current.depth + 1 });
          }
        }
      }
    }

    // Also highlight spouses of the selected member and their descendants
    for (const rel of relationships) {
      if (
        (rel.relationship_type === "spouse" || rel.relationship_type === "divorced") &&
        (rel.from_member_id === selectedMemberId || rel.to_member_id === selectedMemberId)
      ) {
        edgeIds.add(rel.id);
        const spouseId = rel.from_member_id === selectedMemberId ? rel.to_member_id : rel.from_member_id;
        nodeIds.add(spouseId);
        // Include the spouse's descendants too (same depth limit)
        const spouseQueue: Array<{ id: string; depth: number }> = [{ id: spouseId, depth: 0 }];
        const spouseVisited = new Set<string>([selectedMemberId, spouseId]);
        while (spouseQueue.length > 0) {
          const current = spouseQueue.shift()!;
          if (current.depth >= normalizedDescendantHighlightDepth) continue;
          for (const r of relationships) {
            if (
              r.from_member_id === current.id &&
              (r.relationship_type === "parent_child" || r.relationship_type === "adopted")
            ) {
              edgeIds.add(r.id);
              nodeIds.add(r.to_member_id);
              if (!spouseVisited.has(r.to_member_id)) {
                spouseVisited.add(r.to_member_id);
                spouseQueue.push({ id: r.to_member_id, depth: current.depth + 1 });
              }
            }
          }
        }
      }
    }

    return {
      selectedDescendantNodeIds: nodeIds,
      selectedDescendantEdgeIds: edgeIds,
    };
  }, [normalizedDescendantHighlightDepth, relationships, selectedMemberId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase.channel(`tree-live-${tree.id}`, {
      config: { presence: { key: currentUserId || `anon-${Date.now()}` } },
    });

    collaborationChannelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tree_members",
          filter: `tree_id=eq.${tree.id}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as TreeMember;
          if (!row?.id) return;

          if (payload.eventType === "INSERT") {
            setMembers((prev) => {
              if (prev.some((member) => member.id === row.id)) return prev;
              return [...prev, row];
            });
            return;
          }

          if (payload.eventType === "UPDATE") {
            setMembers((prev) => prev.map((member) => (member.id === row.id ? ({ ...member, ...row }) : member)));
            return;
          }

          if (payload.eventType === "DELETE") {
            setMembers((prev) => prev.filter((member) => member.id !== row.id));
            setRelationships((prev) => prev.filter((rel) => rel.from_member_id !== row.id && rel.to_member_id !== row.id));
            setSelectedNodeIds((prev) => {
              if (!prev.has(row.id)) return prev;
              const next = new Set(prev);
              next.delete(row.id);
              return next;
            });
            setSelectedMemberId((prev) => (prev === row.id ? null : prev));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "relationships",
          filter: `tree_id=eq.${tree.id}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as Relationship;
          if (!row?.id) return;

          if (payload.eventType === "INSERT") {
            setRelationships((prev) => {
              if (prev.some((rel) => rel.id === row.id)) return prev;
              return [...prev, row];
            });
            return;
          }

          if (payload.eventType === "UPDATE") {
            setRelationships((prev) => prev.map((rel) => (rel.id === row.id ? ({ ...rel, ...row }) : rel)));
            return;
          }

          if (payload.eventType === "DELETE") {
            setRelationships((prev) => prev.filter((rel) => rel.id !== row.id));
          }
        }
      )
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const cursor = payload as CollaboratorCursor;
        if (!cursor?.userId || cursor.userId === currentUserId) return;
        setRemoteCursors((prev) => ({ ...prev, [cursor.userId]: cursor }));
      })
      .on("broadcast", { event: "member-updated" }, ({ payload }) => {
        const member = payload as TreeMember;
        if (!member?.id) return;
        setMembers((prev) => prev.map((existing) => (existing.id === member.id ? ({ ...existing, ...member }) : existing)));
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<CollaboratorPresence>();
        const next: Record<string, CollaboratorPresence> = {};
        for (const [key, entries] of Object.entries(state)) {
          const latest = entries.at(-1);
          if (!latest) continue;
          const normalizedUserId = latest.userId || key;
          if (normalizedUserId === currentUserId) continue;
          next[normalizedUserId] = {
            userId: normalizedUserId,
            name: latest.name || "Collaborator",
            avatarUrl: latest.avatarUrl ?? null,
            color: latest.color || colorFromUserId(normalizedUserId),
            selectedMemberId: latest.selectedMemberId ?? null,
            editingLock: latest.editingLock ?? null,
          };
        }
        setRemoteCollaborators(next);
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        await channel.track({
          userId: currentUserId,
          name: resolvedCurrentUserName,
          avatarUrl: currentUserAvatarUrl ?? null,
          color: selfColor,
          selectedMemberId: null,
          editingLock: null,
        } as CollaboratorPresence);
      });

    return () => {
      collaborationChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [currentUserAvatarUrl, currentUserId, resolvedCurrentUserName, selfColor, tree.id]);

  useEffect(() => {
    const channel = collaborationChannelRef.current;
    if (!channel) return;

    channel.track({
      userId: currentUserId,
      name: resolvedCurrentUserName,
      avatarUrl: currentUserAvatarUrl ?? null,
      color: selfColor,
      selectedMemberId,
      editingLock: activeEditLock,
    } as CollaboratorPresence).catch(() => {
      // best effort presence updates
    });
  }, [activeEditLock, currentUserAvatarUrl, currentUserId, resolvedCurrentUserName, selectedMemberId, selfColor]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setRemoteCursors((prev) => {
        const next: Record<string, CollaboratorCursor> = {};
        for (const [userId, cursor] of Object.entries(prev)) {
          if (now - cursor.ts < 5000) next[userId] = cursor;
        }
        return next;
      });
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  // Keep nodesRef in sync
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // Wrap onNodesChange to track position changes for saving
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  // When members/relationships change (new data from server), update nodes
  // but preserve positions of existing nodes. New nodes land at viewport center.
  useEffect(() => {
    setNodes((currentNodes) => {
      const currentPositions = new Map(currentNodes.map((n) => [n.id, n.position]));
      const pendingCenter = pendingViewportCenterRef.current;
      let usedCenter = false;
      const result = initialNodes.map((n) => {
        const existing = currentPositions.get(n.id);
        if (existing) return { ...n, position: existing };
        // New node — place at viewport center if we have one
        if (pendingCenter) {
          usedCenter = true;
          return { ...n, position: { x: pendingCenter.x - 100, y: pendingCenter.y - 50 } };
        }
        return n;
      });
      if (usedCenter) pendingViewportCenterRef.current = null;
      return result;
    });
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Fit view on initial load only
  useEffect(() => {
    if (members.length > 0 && !hasInitialized.current) {
      hasInitialized.current = true;
      const timer = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100);
      return () => clearTimeout(timer);
    }
  }, [members.length, fitView]);

  // Update node data for highlighting WITHOUT resetting positions
  useEffect(() => {
    const remoteSelectionByNode = new Map<string, { userId: string; name: string; color: string; avatarUrl: string | null }>();
    for (const collaborator of Object.values(remoteCollaborators)) {
      if (!collaborator.selectedMemberId) continue;
      if (!remoteSelectionByNode.has(collaborator.selectedMemberId)) {
        remoteSelectionByNode.set(collaborator.selectedMemberId, {
          userId: collaborator.userId,
          name: collaborator.name,
          color: collaborator.color,
          avatarUrl: collaborator.avatarUrl,
        });
      }
    }

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isSelected: n.id === selectedMemberId,
          highlightVariant: highlightedPath.includes(n.id)
            ? "path"
            : selectedDescendantNodeIds.has(n.id)
              ? "descendant"
              : "none",
          remoteSelection: remoteSelectionByNode.get(n.id) ?? null,
        },
      }))
    );
  }, [selectedMemberId, highlightedPath, remoteCollaborators, selectedDescendantNodeIds, setNodes]);

  // Update edge highlighting WITHOUT resetting positions
  useEffect(() => {
    const hoverEdgeIds = new Set<string>();
    if (hoveredRelMemberId && selectedMemberId) {
      for (const rel of relationships) {
        if (
          (rel.from_member_id === selectedMemberId && rel.to_member_id === hoveredRelMemberId) ||
          (rel.to_member_id === selectedMemberId && rel.from_member_id === hoveredRelMemberId)
        ) {
          hoverEdgeIds.add(rel.id);
        }
      }
    }

    setEdges((eds) =>
      eds.map((e) => {
        const arcData = e.data as FamilyArcEdgeData | null;
        let highlightMode: EdgeHighlightMode;
        if (arcData?.isFamilyArc) {
          const relIds: string[] = arcData.originalRelIds ?? [];
          highlightMode = relIds.some((id) => highlightedEdges.includes(id))
            ? "path"
            : relIds.some((id) => selectedDescendantEdgeIds.has(id))
              ? "descendant"
              : "none";
        } else {
          highlightMode = hoverEdgeIds.has(e.id)
            ? "hover"
            : highlightedEdges.includes(e.id)
              ? "path"
              : selectedDescendantEdgeIds.has(e.id)
                ? "descendant"
                : "none";
        }
        return { ...e, data: { ...e.data, highlightMode } };
      })
    );
  }, [highlightedEdges, hoveredRelMemberId, selectedDescendantEdgeIds, selectedMemberId, relationships, setEdges]);

  // Path highlighting logic
  useEffect(() => {
    if (pathStart && pathEnd && pathStart !== pathEnd) {
      const path = findPath(relationships, pathStart, pathEnd);
      if (path) {
        setHighlightedPath(path.map((s) => s.memberId));
        setHighlightedEdges(getPathRelationshipIds(path));
        setRelationshipLabel(calculateRelationship(path));
      } else {
        setHighlightedPath([]);
        setHighlightedEdges([]);
        setRelationshipLabel("No connection found");
      }
    } else {
      setHighlightedPath([]);
      setHighlightedEdges([]);
      setRelationshipLabel(null);
    }
  }, [pathStart, pathEnd, relationships]);

  const clearSelection = useCallback(() => {
    setSelectedMemberId(null);
    setSelectedNodeIds(new Set());
    setHoveredRelMemberId(null);
    setPathStart(null);
    setPathEnd(null);
    setHighlightedPath([]);
    setHighlightedEdges([]);
    setRelationshipLabel(null);
    setContextMenu(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Search shortcut
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
        return;
      }

      // Undo: Ctrl/Cmd+Z
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y
      if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "z") ||
        ((e.metaKey || e.ctrlKey) && e.key === "y")
      ) {
        e.preventDefault();
        redo();
        return;
      }

      // Delete/Backspace: delete selected node(s)
      if ((e.key === "Delete" || e.key === "Backspace") && canEdit) {
        // Don't trigger if user is typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
          return;
        }

        if (selectedNodeIds.size > 1) {
          const targets = members.filter((m) => selectedNodeIds.has(m.id));
          if (targets.length > 0) {
            setBulkDeleteTargets(targets);
          }
        } else if (selectedMemberId) {
          const member = members.find((m) => m.id === selectedMemberId);
          if (member) {
            setDeleteTarget(member);
          }
        }
        return;
      }

      // Escape: close context menu, clear selection
      if (e.key === "Escape") {
        if (contextMenu) {
          setContextMenu(null);
        } else {
          clearSelection();
        }
        return;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection, undo, redo, canEdit, selectedMemberId, selectedNodeIds, members, contextMenu]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const memberId = node.id;

      // Close context menu on any click
      setContextMenu(null);

      // Alt+click for path highlighting
      if (_event.altKey) {
        if (!pathStart) {
          setPathStart(memberId);
          toast.info("Now Alt-click another member to see the relationship");
        } else if (pathStart !== memberId) {
          setPathEnd(memberId);
        }
        return;
      }

      // Shift+click for multi-select
      if (_event.shiftKey) {
        setSelectedNodeIds((prev) => {
          const next = new Set(prev);
          if (next.has(memberId)) {
            next.delete(memberId);
          } else {
            next.add(memberId);
          }
          // Also include currently selected member in multi-select
          if (selectedMemberId && !next.has(selectedMemberId)) {
            next.add(selectedMemberId);
          }
          next.add(memberId);
          return next;
        });
        if (!selectedMemberId) {
          setSelectedMemberId(memberId);
        }
        return;
      }

      // Regular click: single select, clear multi-select
      setSelectedNodeIds(new Set());
      setSelectedMemberId(memberId);
    },
    [pathStart, selectedMemberId]
  );

  // Context menu handler
  const handleNodeContextMenu: NodeMouseHandler = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        memberId: node.id,
        x: event.clientX,
        y: event.clientY,
      });
    },
    []
  );

  const handlePaneClick = useCallback(() => {
    setSelectedMemberId(null);
    setSelectedNodeIds(new Set());
    setHoveredRelMemberId(null);
    setContextMenu(null);
  }, []);

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const channel = collaborationChannelRef.current;
    if (!channel || !currentUserId) return;

    const now = Date.now();
    if (now - cursorSentAtRef.current < 40) return;
    cursorSentAtRef.current = now;

    const rect = event.currentTarget.getBoundingClientRect();
    channel.send({
      type: "broadcast",
      event: "cursor",
      payload: {
        userId: currentUserId,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        ts: now,
      } satisfies CollaboratorCursor,
    }).catch(() => {
      // best effort cursor sync
    });
  }, [currentUserId]);

  const handleCanvasMouseLeave = useCallback(() => {
    const channel = collaborationChannelRef.current;
    if (!channel || !currentUserId) return;
    channel.send({
      type: "broadcast",
      event: "cursor",
      payload: {
        userId: currentUserId,
        x: -1000,
        y: -1000,
        ts: Date.now(),
      } satisfies CollaboratorCursor,
    }).catch(() => {
      // best effort cursor sync
    });
  }, [currentUserId]);

  // Handle drag-to-connect: right/left handles → spouse; bottom/top handles → parent_child
  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!canEdit || !connection.source || !connection.target) return;
      const isSpouseConnect = connection.sourceHandle === "right" || connection.targetHandle === "left";
      try {
        await createRelationship({
          tree_id: tree.id,
          from_member_id: connection.source,
          to_member_id: connection.target,
          relationship_type: isSpouseConnect ? "spouse" : "parent_child",
        });
        toast.success(isSpouseConnect ? "Spouse connection created" : "Relationship created");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create relationship");
      }
    },
    [canEdit, tree.id, router]
  );

  const handleConnectStart = useCallback<OnConnectStart>((_event, params) => {
    pendingConnectStartRef.current = {
      nodeId: params.nodeId,
      handleId: params.handleId,
    };
  }, []);

  const handleConnectEnd = useCallback<OnConnectEnd>(
    (_event, connectionState) => {
      const start = pendingConnectStartRef.current;
      pendingConnectStartRef.current = null;

      if (!canEdit || !start?.nodeId) return;
      if (connectionState.toNode) return;
      if (!members.some((member) => member.id === start.nodeId)) return;

      let relationshipDirection: "parent" | "child" | "spouse" = "child";

      if (start.handleId === "right" || start.handleId === "left") {
        relationshipDirection = "spouse";
      } else if (start.handleId === "top") {
        relationshipDirection = "parent";
      } else if (start.handleId === "bottom") {
        relationshipDirection = "child";
      } else {
        const sourceNode = nodesRef.current.find((node) => node.id === start.nodeId);
        const sourceCenterY = sourceNode ? sourceNode.position.y + 50 : null;
        const pointerY = connectionState.pointer?.y ?? null;
        if (sourceCenterY != null && pointerY != null) {
          relationshipDirection = pointerY < sourceCenterY ? "parent" : "child";
        }
      }

      setAddMemberDefaults({
        relatedMemberId: start.nodeId,
        relationshipDirection,
      });
      setShowAddDialog(true);
    },
    [canEdit, members]
  );

  const handleAddDialogOpenChange = useCallback((open: boolean) => {
    setShowAddDialog(open);
    if (!open) {
      setAddMemberDefaults(null);
    }
  }, []);

  // Save positions to DB after drag (debounced) — uses ref to avoid setState-in-render
  const handleNodeDragStop = useCallback(
    () => {
      if (!canEdit) return;

      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        const positions = nodesRef.current.map((n) => ({
          id: n.id,
          position_x: Math.round(n.position.x),
          position_y: Math.round(n.position.y),
        }));
        saveMemberPositions(tree.id, positions).catch(() => {
          // Silent fail — positions will be re-computed next load
        });
      }, 500);
    },
    [canEdit, tree.id]
  );

  // Keep spouse edges horizontal by dynamically choosing left node as source and right node as target.
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
          return {
            ...edge,
            sourceHandle: "right",
            targetHandle: "left",
          };
        }

        return edge;
      });

      return hasChanges ? updatedEdges : currentEdges;
    });
  }, [nodes, setEdges]);

  const handleMemberAdded = useCallback(() => {
    // Capture viewport center so new node appears where the user is looking
    pendingViewportCenterRef.current = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    router.refresh();
  }, [router, screenToFlowPosition]);

  const handleAutoLayout = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const layoutNode = layout.nodes.find((ln) => ln.id === n.id);
        return layoutNode ? { ...n, position: layoutNode.position } : n;
      })
    );
    saveMemberPositions(
      tree.id,
      layout.nodes.map((ln) => ({
        id: ln.id,
        position_x: Math.round(ln.position.x),
        position_y: Math.round(ln.position.y),
      }))
    ).catch(() => {});
    setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50);
  }, [layout.nodes, setNodes, tree.id, fitView]);

  const handleSelectMemberFromPanel = useCallback(
    (id: string) => {
      setSelectedMemberId(id);
      setHoveredRelMemberId(null);
      const node = nodesRef.current.find((n) => n.id === id);
      if (node) {
        setCenter(
          node.position.x + 100,
          node.position.y + 50,
          { zoom: 1, duration: 300 }
        );
      }
    },
    [setCenter]
  );

  const handleHoverRelMember = useCallback((id: string | null) => {
    setHoveredRelMemberId(id);
  }, []);

  const handleSearchSelect = useCallback(
    (memberId: string) => {
      setSelectedMemberId(memberId);
      setShowSearch(false);
      const node = nodesRef.current.find((n) => n.id === memberId);
      if (node) {
        setCenter(
          node.position.x + 100,
          node.position.y + 50,
          { zoom: 1, duration: 300 }
        );
      }
    },
    [setCenter]
  );

  // Close context menu on pan/zoom
  const handleMoveStart = useCallback(() => {
    setContextMenu(null);
  }, []);

  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const contextMenuMember = contextMenu ? members.find((m) => m.id === contextMenu.memberId) : null;
  const remoteFieldLocks = useMemo(() => {
    const locks: Record<string, { userId: string; name: string; color: string; avatarUrl: string | null }> = {};
    if (!selectedMember) return locks;

    for (const collaborator of Object.values(remoteCollaborators)) {
      const lock = collaborator.editingLock;
      if (!lock || lock.memberId !== selectedMember.id) continue;
      locks[lock.field] = {
        userId: collaborator.userId,
        name: collaborator.name,
        color: collaborator.color,
        avatarUrl: collaborator.avatarUrl,
      };
    }
    return locks;
  }, [remoteCollaborators, selectedMember]);

  const handleFieldEditStart = useCallback((memberId: string, field: string) => {
    setActiveEditLock({ memberId, field });
  }, []);

  const handleFieldEditEnd = useCallback((memberId: string, field: string) => {
    setActiveEditLock((current) => {
      if (!current) return current;
      if (current.memberId === memberId && current.field === field) return null;
      return current;
    });
  }, []);

  const handleMemberFieldSaved = useCallback((updatedMember: TreeMember) => {
    setMembers((prev) => prev.map((member) => (member.id === updatedMember.id ? ({ ...member, ...updatedMember }) : member)));

    const channel = collaborationChannelRef.current;
    if (!channel) return;
    channel.send({
      type: "broadcast",
      event: "member-updated",
      payload: updatedMember,
    }).catch(() => {
      // best effort member sync
    });
  }, []);

  return (
    <div className="w-full h-full relative" onMouseMove={handleCanvasMouseMove} onMouseLeave={handleCanvasMouseLeave}>
      <TooltipProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeContextMenu={handleNodeContextMenu}
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={handlePaneClick}
          onMoveStart={handleMoveStart}
          onConnect={handleConnect}
          onConnectStart={handleConnectStart}
          onConnectEnd={handleConnectEnd}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={canEdit}
          nodesConnectable={canEdit}
          connectionLineStyle={{ stroke: "oklch(0.55 0.08 155)", strokeWidth: 2 }}
          style={{ background: 'transparent' }}
        >
          <Background gap={24} size={1} color="oklch(0.8 0.01 75 / 0.15)" />
          <MiniMap
            nodeStrokeWidth={3}
            className="glass-card rounded-lg! shadow-sm!"
            maskColor="oklch(0.5 0 0 / 0.1)"
          />
        </ReactFlow>

        {/* Toolbar */}
        <TreeToolbar
          treeId={tree.id}
          onAddMember={() => setShowAddDialog(true)}
          onSearch={() => setShowSearch(true)}
          onImportGedcom={() => setShowImportDialog(true)}
          onLinkMembers={() => setShowAddRelationshipDialog(true)}
          onInviteMembers={permissions?.isOwner ? (() => router.push(`/tree/${tree.id}/settings?invite=new#invites`)) : undefined}
          onAutoLayout={handleAutoLayout}
          treeName={tree.name}
          canEdit={canEdit}
        />

        {/* Undo/Redo floating controls */}
        {(canUndo || canRedo) && (
          <div className="absolute top-4 right-4 z-10 flex items-center gap-1 glass-card glass-light rounded-xl p-1.5" data-export-exclude>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!canUndo}
                  onClick={() => undo()}
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {canUndo ? `Undo: ${undoDescription}` : "Nothing to undo"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!canRedo}
                  onClick={() => redo()}
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {canRedo ? `Redo: ${redoDescription}` : "Nothing to redo"}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Multi-select bulk action bar */}
        {selectedNodeIds.size > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 glass-card glass-light rounded-xl px-4 py-2 flex items-center gap-3" data-export-exclude>
            <span className="text-sm font-medium">{selectedNodeIds.size} selected</span>
            {canEdit && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  const targets = members.filter((m) => selectedNodeIds.has(m.id));
                  if (targets.length > 0) {
                    setBulkDeleteTargets(targets);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete Selected
              </Button>
            )}
            <button
              onClick={() => setSelectedNodeIds(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        {/* Relationship label */}
        {relationshipLabel && selectedNodeIds.size <= 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 glass-card glass-light rounded-xl px-4 py-2 flex items-center gap-3" data-export-exclude>
            <span className="text-sm font-medium">{relationshipLabel}</span>
            <button
              onClick={clearSelection}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </div>
        )}

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
              <MousePointer2 className="h-4 w-4" style={{ color: collaborator.color, fill: collaborator.color }} />
              <div
                className="mt-1 inline-flex items-center gap-1.5 rounded-full glass-card glass-light px-2 py-1 text-[11px] font-medium"
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
                  <span className="h-3.5 w-3.5 rounded-full text-[9px] flex items-center justify-center" style={{ backgroundColor: `${collaborator.color}33`, color: collaborator.color }}>
                    {collaborator.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span>{collaborator.name}</span>
              </div>
            </div>
          );
        })}

        {/* Context menu */}
        {contextMenu && contextMenuMember && (
          <NodeContextMenu
            member={contextMenuMember}
            position={{ x: contextMenu.x, y: contextMenu.y }}
            canEdit={canEdit}
            onEdit={() => setEditingMember(contextMenuMember)}
            onDelete={() => setDeleteTarget(contextMenuMember)}
            onAddChild={() => {
              setSelectedMemberId(contextMenuMember.id);
              setShowAddDialog(true);
            }}
            onAddSpouse={() => {
              setSelectedMemberId(contextMenuMember.id);
              setShowAddDialog(true);
            }}
            onViewDetails={() => setSelectedMemberId(contextMenuMember.id)}
            onViewProfile={() => {
              setSelectedMemberId(contextMenuMember.id);
            }}
            onClose={() => setContextMenu(null)}
          />
        )}

        {/* Detail panel */}
        {selectedMember && (
          <MemberDetailPanel
            member={selectedMember}
            relationships={relationships}
            allMembers={members}
            canEditMember={canEditMember}
            treeId={tree.id}
            currentUserId={currentUserId}
            permissions={permissions ?? null}
            linkedProfile={nodeProfileMap[selectedMember.id] ?? null}
            collaboratorLocks={remoteFieldLocks}
            onFieldEditStart={handleFieldEditStart}
            onFieldEditEnd={handleFieldEditEnd}
            onMemberFieldSaved={handleMemberFieldSaved}
            onClose={() => { setSelectedMemberId(null); setHoveredRelMemberId(null); }}
            onEdit={() => setEditingMember(selectedMember)}
            onDelete={() => setDeleteTarget(selectedMember)}
            onSelectMember={handleSelectMemberFromPanel}
            onHoverMember={handleHoverRelMember}
          />
        )}

        {/* Add member dialog */}
        <AddMemberDialog
          open={showAddDialog}
          onOpenChange={handleAddDialogOpenChange}
          treeId={tree.id}
          existingMembers={members}
          onMemberAdded={handleMemberAdded}
          defaultRelatedMemberId={addMemberDefaults?.relatedMemberId}
          defaultRelationshipDirection={addMemberDefaults?.relationshipDirection}
        />

        {/* Add relationship dialog */}
        <AddRelationshipDialog
          open={showAddRelationshipDialog}
          onOpenChange={setShowAddRelationshipDialog}
          treeId={tree.id}
          members={members}
          onRelationshipAdded={handleMemberAdded}
        />

        {/* GEDCOM import dialog */}
        <GedcomImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          treeId={tree.id}
        />

        {/* Search */}
        <TreeSearch
          open={showSearch}
          onOpenChange={setShowSearch}
          members={members}
          onSelect={handleSearchSelect}
        />

        {/* Edit member dialog */}
        {editingMember && (
          <EditMemberDialog
            open={!!editingMember}
            onOpenChange={(open) => { if (!open) setEditingMember(null); }}
            member={editingMember}
            treeId={tree.id}
            onUpdated={() => {
              setEditingMember(null);
              router.refresh();
            }}
          />
        )}

        {/* Delete confirm (single) */}
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={() => setDeleteTarget(null)}
          title="Delete member?"
          description={`This will permanently remove ${deleteTarget?.first_name ?? ""} ${deleteTarget?.last_name ?? ""} and all their relationships from the tree.`}
          confirmLabel="Delete"
          destructive
          loading={deleting}
          onConfirm={async () => {
            if (!deleteTarget) return;
            setDeleting(true);
            const memberToDelete = deleteTarget;
            try {
              await pushUndo({
                type: "delete_member",
                description: `Delete ${memberToDelete.first_name} ${memberToDelete.last_name ?? ""}`.trim(),
                execute: async () => {
                  await deleteMember(memberToDelete.id, tree.id);
                },
                undo: async () => {
                  // Undo is best-effort; server action would need a restore endpoint
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
          }}
        />

        {/* Bulk delete confirm */}
        <ConfirmDialog
          open={!!bulkDeleteTargets}
          onOpenChange={() => setBulkDeleteTargets(null)}
          title={`Delete ${bulkDeleteTargets?.length ?? 0} members?`}
          description="This will permanently remove the selected members and all their relationships from the tree."
          confirmLabel="Delete All"
          destructive
          loading={deleting}
          onConfirm={async () => {
            if (!bulkDeleteTargets) return;
            setDeleting(true);
            try {
              for (const member of bulkDeleteTargets) {
                await deleteMember(member.id, tree.id);
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
          }}
        />
      </TooltipProvider>
    </div>
  );
}

export function TreeCanvas(props: TreeCanvasProps) {
  return (
    <ReactFlowProvider>
      <TreeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
