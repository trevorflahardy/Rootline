"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  MiniMap,
  useReactFlow,
  type Node,
  type NodeTypes,
  type EdgeTypes,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUndoRedo } from "@/lib/hooks/use-undo-redo";
import { MemberNode } from "./member-node";
import { RelationshipEdge } from "./relationship-edge";
import { FamilyArcEdge } from "./family-arc-edge";
import { CoupleBlockNode } from "./couple-block-node";
import { NodeContextMenu } from "./node-context-menu";
import { TreeToolbar } from "./tree-toolbar";
import { MemberDetailPanel } from "./member-detail-panel";
import { AddMemberDialog } from "./add-member-dialog";
import { AddRelationshipDialog } from "./add-relationship-dialog";
import { EditMemberDialog } from "./edit-member-dialog";
import { TreeSearch } from "./tree-search";
import { GedcomImportDialog } from "@/components/import-export/gedcom-import-dialog";
import type { TreeMember, Relationship, FamilyTree } from "@/types";
import {
  canEditMember as checkCanEditMember,
  type NodeProfileLink,
  type TreePermissions,
} from "@/lib/actions/permissions";
import { useTreeRealtime } from "./hooks/use-tree-realtime";
import { useTreeLayout } from "./hooks/use-tree-layout";
import { useTreeContextMenu } from "./hooks/use-tree-context-menu";
import { useTreeDescendants } from "./hooks/use-tree-descendants";
import { useTreeConnections } from "./hooks/use-tree-connections";
import { useTreeKeyboard } from "./hooks/use-tree-keyboard";
import { useTreeHighlightSync } from "./hooks/use-tree-highlight-sync";
import { useTreeNodeSync } from "./hooks/use-tree-node-sync";
import { useTreePathFinder } from "./hooks/use-tree-path-finder";
import {
  UndoRedoControls,
  BulkActionBar,
  RelationshipLabelBar,
  RemoteCursorsOverlay,
  DeleteMemberDialogs,
} from "./tree-canvas-toolbar";

const nodeTypes: NodeTypes = {
  member: MemberNode as unknown as NodeTypes["member"],
  coupleBlock: CoupleBlockNode as unknown as NodeTypes["coupleBlock"],
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

type CollaboratorLock = { memberId: string; field: string };

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
  const { setCenter, screenToFlowPosition } = useReactFlow();
  const router = useRouter();

  const canEditMember = useCallback(
    async (memberId: string): Promise<boolean> => {
      if (!canEdit) return false;
      if (permissions?.isOwner) return true;
      return checkCanEditMember(tree.id, memberId);
    },
    [canEdit, permissions?.isOwner, tree.id]
  );

  const [members, setMembers] = useState(initialMembers);
  const [relationships, setRelationships] = useState(initialRelationships);

  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);
  useEffect(() => {
    setRelationships(initialRelationships);
  }, [initialRelationships]);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [hoveredRelMemberId, setHoveredRelMemberId] = useState<string | null>(null);

  const {
    pathStart,
    setPathStart,
    setPathEnd,
    highlightedPath,
    highlightedEdges,
    relationshipLabel,
    clearPath,
  } = useTreePathFinder(relationships);

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
  const [activeEditLock, setActiveEditLock] = useState<CollaboratorLock | null>(null);

  const [joinEnabledMap, setJoinEnabledMap] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(`rootline-join-${tree.id}`);
      return stored ? (JSON.parse(stored) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  const {
    push: pushUndo,
    undo,
    redo,
    canUndo,
    canRedo,
    undoDescription,
    redoDescription,
  } = useUndoRedo();

  const normalizedDescendantHighlightDepth = Number.isFinite(descendantHighlightDepth)
    ? Math.min(10, Math.max(0, Math.trunc(descendantHighlightDepth)))
    : 1;

  const pendingViewportCenterRef = useRef<{ x: number; y: number } | null>(null);
  const pendingSecondParentRef = useRef<string | null>(null);

  const { contextMenu, setContextMenu, handleNodeContextMenu, closeContextMenu } =
    useTreeContextMenu();

  const { remoteCollaborators, remoteCursors, sendCursor, sendCursorLeave, broadcastMemberUpdate } =
    useTreeRealtime({
      treeId: tree.id,
      currentUserId,
      currentUserName,
      currentUserAvatarUrl,
      selectedMemberId,
      activeEditLock,
      setMembers,
      setRelationships,
      setSelectedNodeIds,
      setSelectedMemberId,
      pendingSecondParentRef,
    });

  const { layout, initialNodes, initialEdges } = useTreeLayout(
    members,
    relationships,
    joinEnabledMap,
    nodeProfileMap
  );

  const defaultEdgeOptions = useMemo(() => ({}), []);

  const { selectedDescendantNodeIds, selectedDescendantEdgeIds } = useTreeDescendants(
    selectedMemberId,
    relationships,
    normalizedDescendantHighlightDepth
  );

  const {
    nodes,
    edges,
    nodesRef,
    setNodes,
    setEdges,
    onEdgesChange,
    handleNodesChange,
    handleNodeDragStop,
    handleAutoLayout,
  } = useTreeNodeSync({
    treeId: tree.id,
    canEdit,
    memberCount: members.length,
    initialNodes,
    initialEdges,
    layout,
    joinEnabledMap,
    setJoinEnabledMap,
    pendingViewportCenterRef,
  });

  useTreeHighlightSync({
    selectedMemberId,
    highlightedPath,
    highlightedEdges,
    hoveredRelMemberId,
    remoteCollaborators,
    selectedDescendantNodeIds,
    selectedDescendantEdgeIds,
    relationships,
    setNodes,
    setEdges,
  });

  const clearSelection = useCallback(() => {
    setSelectedMemberId(null);
    setSelectedNodeIds(new Set());
    setHoveredRelMemberId(null);
    clearPath();
    setContextMenu(null);
  }, [clearPath, setContextMenu]);

  useTreeKeyboard({
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
  });

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === "coupleBlock") return;
      const memberId = node.id;
      closeContextMenu();
      if (_event.altKey) {
        if (!pathStart) {
          setPathStart(memberId);
          toast.info("Now Alt-click another member to see the relationship");
        } else if (pathStart !== memberId) {
          setPathEnd(memberId);
        }
        return;
      }
      if (_event.shiftKey) {
        setSelectedNodeIds((prev) => {
          const next = new Set(prev);
          if (next.has(memberId)) {
            next.delete(memberId);
          } else {
            next.add(memberId);
          }
          if (selectedMemberId && !next.has(selectedMemberId)) next.add(selectedMemberId);
          next.add(memberId);
          return next;
        });
        if (!selectedMemberId) setSelectedMemberId(memberId);
        return;
      }
      setSelectedNodeIds(new Set());
      setSelectedMemberId(memberId);
    },
    [pathStart, selectedMemberId, closeContextMenu, setPathStart, setPathEnd]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedMemberId(null);
    setSelectedNodeIds(new Set());
    setHoveredRelMemberId(null);
    closeContextMenu();
  }, [closeContextMenu]);

  const handleCanvasMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      sendCursor(event);
    },
    [sendCursor]
  );

  const handleCanvasMouseLeave = useCallback(() => {
    sendCursorLeave();
  }, [sendCursorLeave]);

  const { handleConnect, handleConnectStart, handleConnectEnd } = useTreeConnections({
    canEdit,
    treeId: tree.id,
    members,
    nodesRef,
    pendingSecondParentRef,
    setAddMemberDefaults,
    setShowAddDialog,
  });

  const handleAddDialogOpenChange = useCallback((open: boolean) => {
    setShowAddDialog(open);
    if (!open) {
      setAddMemberDefaults(null);
      pendingSecondParentRef.current = null;
    }
  }, []);

  const handleMemberAdded = useCallback(() => {
    pendingViewportCenterRef.current = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    router.refresh();
  }, [router, screenToFlowPosition]);

  const handleSelectMemberFromPanel = useCallback(
    (id: string) => {
      setSelectedMemberId(id);
      setHoveredRelMemberId(null);
      const node = nodesRef.current.find((n) => n.id === id);
      if (node) setCenter(node.position.x + 100, node.position.y + 50, { zoom: 1, duration: 300 });
    },
    [setCenter, nodesRef]
  );

  const handleHoverRelMember = useCallback((id: string | null) => {
    setHoveredRelMemberId(id);
  }, []);

  const handleSearchSelect = useCallback(
    (memberId: string) => {
      setSelectedMemberId(memberId);
      setShowSearch(false);
      const node = nodesRef.current.find((n) => n.id === memberId);
      if (node) setCenter(node.position.x + 100, node.position.y + 50, { zoom: 1, duration: 300 });
    },
    [setCenter, nodesRef]
  );

  const handleMoveStart = useCallback(() => {
    closeContextMenu();
  }, [closeContextMenu]);

  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const contextMenuMember = contextMenu ? members.find((m) => m.id === contextMenu.memberId) : null;

  const remoteFieldLocks = useMemo(() => {
    const locks: Record<
      string,
      { userId: string; name: string; color: string; avatarUrl: string | null }
    > = {};
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

  const handleMemberFieldSaved = useCallback(
    (updatedMember: TreeMember) => {
      setMembers((prev) =>
        prev.map((member) =>
          member.id === updatedMember.id ? { ...member, ...updatedMember } : member
        )
      );
      broadcastMemberUpdate(updatedMember);
    },
    [broadcastMemberUpdate]
  );

  return (
    <div
      className="relative h-full w-full"
      onMouseMove={handleCanvasMouseMove}
      onMouseLeave={handleCanvasMouseLeave}
    >
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
          style={{ background: "transparent" }}
          role="application"
          aria-label="Family tree visualization"
          aria-roledescription="family tree"
        >
          <Background gap={24} size={1} color="oklch(0.8 0.01 75 / 0.15)" />
          <MiniMap
            nodeStrokeWidth={3}
            className="glass-card rounded-lg! shadow-sm!"
            maskColor="oklch(0.5 0 0 / 0.1)"
          />
        </ReactFlow>

        <TreeToolbar
          treeId={tree.id}
          onAddMember={() => setShowAddDialog(true)}
          onSearch={() => setShowSearch(true)}
          onImportGedcom={() => setShowImportDialog(true)}
          onLinkMembers={() => setShowAddRelationshipDialog(true)}
          onInviteMembers={
            permissions?.isOwner
              ? () => router.push(`/tree/${tree.id}/settings?invite=new#invites`)
              : undefined
          }
          onAutoLayout={handleAutoLayout}
          treeName={tree.name}
          canEdit={canEdit}
        />

        <UndoRedoControls
          canUndo={canUndo}
          canRedo={canRedo}
          undoDescription={undoDescription}
          redoDescription={redoDescription}
          onUndo={() => undo()}
          onRedo={() => redo()}
        />

        <BulkActionBar
          selectedCount={selectedNodeIds.size}
          canEdit={canEdit}
          onBulkDelete={() => {
            const targets = members.filter((m) => selectedNodeIds.has(m.id));
            if (targets.length > 0) setBulkDeleteTargets(targets);
          }}
          onClearSelection={() => setSelectedNodeIds(new Set())}
        />

        <RelationshipLabelBar
          label={relationshipLabel}
          visible={selectedNodeIds.size <= 1}
          onClear={clearSelection}
        />

        <RemoteCursorsOverlay
          remoteCursors={remoteCursors}
          remoteCollaborators={remoteCollaborators}
        />

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
            onClose={closeContextMenu}
          />
        )}

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
            onClose={() => {
              setSelectedMemberId(null);
              setHoveredRelMemberId(null);
            }}
            onEdit={() => setEditingMember(selectedMember)}
            onDelete={() => setDeleteTarget(selectedMember)}
            onSelectMember={handleSelectMemberFromPanel}
            onHoverMember={handleHoverRelMember}
          />
        )}

        <AddMemberDialog
          open={showAddDialog}
          onOpenChange={handleAddDialogOpenChange}
          treeId={tree.id}
          existingMembers={members}
          onMemberAdded={handleMemberAdded}
          defaultRelatedMemberId={addMemberDefaults?.relatedMemberId}
          defaultRelationshipDirection={addMemberDefaults?.relationshipDirection}
        />

        <AddRelationshipDialog
          open={showAddRelationshipDialog}
          onOpenChange={setShowAddRelationshipDialog}
          treeId={tree.id}
          members={members}
          onRelationshipAdded={handleMemberAdded}
        />

        <GedcomImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          treeId={tree.id}
        />

        <TreeSearch
          open={showSearch}
          onOpenChange={setShowSearch}
          members={members}
          onSelect={handleSearchSelect}
        />

        {editingMember && (
          <EditMemberDialog
            open={!!editingMember}
            onOpenChange={(open) => {
              if (!open) setEditingMember(null);
            }}
            member={editingMember}
            treeId={tree.id}
            onUpdated={() => {
              setEditingMember(null);
              router.refresh();
            }}
          />
        )}

        <DeleteMemberDialogs
          treeId={tree.id}
          deleteTarget={deleteTarget}
          bulkDeleteTargets={bulkDeleteTargets}
          setDeleteTarget={setDeleteTarget}
          setBulkDeleteTargets={setBulkDeleteTargets}
          setSelectedMemberId={setSelectedMemberId}
          setSelectedNodeIds={setSelectedNodeIds}
          pushUndo={pushUndo}
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
