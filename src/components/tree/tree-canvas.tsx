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
  type OnNodesChange,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { computeTreeLayout } from "@/lib/utils/tree-layout";
import { findPath, getPathRelationshipIds } from "@/lib/utils/path-finder";
import { calculateRelationship } from "@/lib/utils/relationship-calculator";
import { deleteMember, saveMemberPositions } from "@/lib/actions/member";
import { createRelationship } from "@/lib/actions/relationship";
import { useRealtimeTree } from "@/lib/hooks/use-realtime-tree";
import { MemberNode, type MemberNodeData } from "./member-node";
import { RelationshipEdge, type RelationshipEdgeData } from "./relationship-edge";
import { TreeToolbar } from "./tree-toolbar";
import { MemberDetailPanel } from "./member-detail-panel";
import { AddMemberDialog } from "./add-member-dialog";
import { EditMemberDialog } from "./edit-member-dialog";
import { TreeSearch } from "./tree-search";
import type { TreeMember, Relationship, FamilyTree } from "@/types";
import type { NodeProfileLink, TreePermissions } from "@/lib/actions/permissions";

const nodeTypes: NodeTypes = {
  member: MemberNode as unknown as NodeTypes["member"],
};

const edgeTypes: EdgeTypes = {
  relationship: RelationshipEdge as unknown as EdgeTypes["relationship"],
};

interface TreeCanvasProps {
  tree: FamilyTree;
  members: TreeMember[];
  relationships: Relationship[];
  canEdit: boolean;
  currentUserId: string;
  nodeProfileMap?: Record<string, NodeProfileLink>;
  permissions?: TreePermissions;
}

function TreeCanvasInner({
  tree,
  members: initialMembers,
  relationships: initialRelationships,
  canEdit,
  currentUserId,
  nodeProfileMap = {},
  permissions,
}: TreeCanvasProps) {
  const { fitView, setCenter } = useReactFlow();
  const router = useRouter();

  const [members, setMembers] = useState(initialMembers);
  const [relationships, setRelationships] = useState(initialRelationships);

  // Sync with server data when props change (after router.refresh)
  useEffect(() => { setMembers(initialMembers); }, [initialMembers]);
  useEffect(() => { setRelationships(initialRelationships); }, [initialRelationships]);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [hoveredRelMemberId, setHoveredRelMemberId] = useState<string | null>(null);
  const [pathStart, setPathStart] = useState<string | null>(null);
  const [pathEnd, setPathEnd] = useState<string | null>(null);
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const [highlightedEdges, setHighlightedEdges] = useState<string[]>([]);
  const [relationshipLabel, setRelationshipLabel] = useState<string | null>(null);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [editingMember, setEditingMember] = useState<TreeMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TreeMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Track whether we've done the initial layout
  const hasInitialized = useRef(false);
  // Track pending position saves (debounced)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to track latest node positions (avoids setState-in-render)
  const nodesRef = useRef<Node[]>([]);

  // Realtime subscription for live updates
  useRealtimeTree(tree.id);

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
          isPathHighlighted: false,
          linkedProfile: nodeProfileMap[n.id] ?? null,
        } as MemberNodeData,
      };
    });
  }, [layout.nodes]);

  const initialEdges: Edge[] = useMemo(() => {
    return layout.edges.map((e) => ({
      ...e,
      data: {
        ...e.data,
        isHighlighted: false,
      } as RelationshipEdgeData,
    }));
  }, [layout.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

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
  // but preserve positions of existing nodes that the user has dragged
  useEffect(() => {
    setNodes((currentNodes) => {
      const currentPositions = new Map(
        currentNodes.map((n) => [n.id, n.position])
      );
      return initialNodes.map((n) => ({
        ...n,
        position: currentPositions.get(n.id) ?? n.position,
      }));
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
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isSelected: n.id === selectedMemberId,
          isPathHighlighted: highlightedPath.includes(n.id),
        },
      }))
    );
  }, [selectedMemberId, highlightedPath, setNodes]);

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
      eds.map((e) => ({
        ...e,
        data: {
          ...e.data,
          isHighlighted: highlightedEdges.includes(e.id) || hoverEdgeIds.has(e.id),
        },
      }))
    );
  }, [highlightedEdges, hoveredRelMemberId, selectedMemberId, relationships, setEdges]);

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

  // Keyboard shortcut for search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === "Escape") {
        clearSelection();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedMemberId(null);
    setHoveredRelMemberId(null);
    setPathStart(null);
    setPathEnd(null);
    setHighlightedPath([]);
    setHighlightedEdges([]);
    setRelationshipLabel(null);
  }, []);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const memberId = node.id;

      if (_event.shiftKey) {
        if (!pathStart) {
          setPathStart(memberId);
          toast.info("Now shift-click another member to see the relationship");
        } else if (pathStart !== memberId) {
          setPathEnd(memberId);
        }
        return;
      }

      setSelectedMemberId(memberId);
    },
    [pathStart]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedMemberId(null);
    setHoveredRelMemberId(null);
  }, []);

  // Handle drag-to-connect: create a parent_child relationship
  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!canEdit || !connection.source || !connection.target) return;

      try {
        await createRelationship({
          tree_id: tree.id,
          from_member_id: connection.source,
          to_member_id: connection.target,
          relationship_type: "parent_child",
        });
        toast.success("Relationship created");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create relationship");
      }
    },
    [canEdit, tree.id, router]
  );

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

  const handleMemberAdded = useCallback(() => {
    router.refresh();
  }, [router]);

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

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  return (
    <div className="w-full h-full relative">
      <TooltipProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={handlePaneClick}
          onConnect={handleConnect}
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
        >
          <Background gap={24} size={1} color="oklch(0.8 0.01 75 / 0.3)" />
          <MiniMap
            nodeStrokeWidth={3}
            className="bg-background/80! border! border-border! rounded-lg! shadow-sm!"
            maskColor="oklch(0.5 0 0 / 0.1)"
          />
        </ReactFlow>

        {/* Toolbar */}
        <TreeToolbar
          onAddMember={() => setShowAddDialog(true)}
          onSearch={() => setShowSearch(true)}
          canEdit={canEdit}
        />

        {/* Relationship label */}
        {relationshipLabel && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-background/95 backdrop-blur-sm border rounded-xl shadow-lg px-4 py-2 flex items-center gap-3">
            <span className="text-sm font-medium">{relationshipLabel}</span>
            <button
              onClick={clearSelection}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        {/* Detail panel */}
        {selectedMember && (
          <MemberDetailPanel
            member={selectedMember}
            relationships={relationships}
            allMembers={members}
            canEdit={canEdit}
            treeId={tree.id}
            currentUserId={currentUserId}
            permissions={permissions ?? null}
            linkedProfile={nodeProfileMap[selectedMember.id] ?? null}
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
          onOpenChange={setShowAddDialog}
          treeId={tree.id}
          existingMembers={members}
          onMemberAdded={handleMemberAdded}
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

        {/* Delete confirm */}
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
            try {
              await deleteMember(deleteTarget.id, tree.id);
              toast.success(`${deleteTarget.first_name} removed`);
              setDeleteTarget(null);
              setSelectedMemberId(null);
              router.refresh();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Failed to delete");
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
