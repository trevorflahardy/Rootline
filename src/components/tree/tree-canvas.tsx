"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
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
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { computeTreeLayout } from "@/lib/utils/tree-layout";
import { findPath, getPathRelationshipIds } from "@/lib/utils/path-finder";
import { calculateRelationship } from "@/lib/utils/relationship-calculator";
import { deleteMember } from "@/lib/actions/member";
import { useRealtimeTree } from "@/lib/hooks/use-realtime-tree";
import { MemberNode, type MemberNodeData } from "./member-node";
import { RelationshipEdge, type RelationshipEdgeData } from "./relationship-edge";
import { TreeToolbar } from "./tree-toolbar";
import { MemberDetailPanel } from "./member-detail-panel";
import { AddMemberDialog } from "./add-member-dialog";
import { EditMemberDialog } from "./edit-member-dialog";
import { TreeSearch } from "./tree-search";
import type { TreeMember, Relationship, FamilyTree } from "@/types";

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
}

function TreeCanvasInner({
  tree,
  members: initialMembers,
  relationships: initialRelationships,
  canEdit,
  currentUserId,
}: TreeCanvasProps) {
  const { fitView } = useReactFlow();
  const router = useRouter();

  const [members, setMembers] = useState(initialMembers);
  const [relationships, setRelationships] = useState(initialRelationships);

  // Sync with server data when props change (after router.refresh)
  useEffect(() => { setMembers(initialMembers); }, [initialMembers]);
  useEffect(() => { setRelationships(initialRelationships); }, [initialRelationships]);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
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

  // Realtime subscription for live updates
  useRealtimeTree(tree.id);

  // Compute layout
  const layout = useMemo(
    () => computeTreeLayout(members, relationships),
    [members, relationships]
  );

  // Apply path highlighting to nodes
  const flowNodes: Node[] = useMemo(() => {
    return layout.nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        isSelected: n.id === selectedMemberId,
        isPathHighlighted: highlightedPath.includes(n.id),
      } as MemberNodeData,
    }));
  }, [layout.nodes, selectedMemberId, highlightedPath]);

  // Apply path highlighting to edges
  const flowEdges: Edge[] = useMemo(() => {
    return layout.edges.map((e) => ({
      ...e,
      data: {
        ...e.data,
        isHighlighted: highlightedEdges.includes(e.id),
      } as RelationshipEdgeData,
    }));
  }, [layout.edges, highlightedEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Sync when layout or highlighting changes
  useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  // Fit view on initial load
  useEffect(() => {
    if (members.length > 0) {
      const timer = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100);
      return () => clearTimeout(timer);
    }
  }, [members.length, fitView]);

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
    setPathStart(null);
    setPathEnd(null);
    setHighlightedPath([]);
    setHighlightedEdges([]);
    setRelationshipLabel(null);
  }, []);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const memberId = node.id;

      // If holding shift, set path endpoint
      if (_event.shiftKey) {
        if (!pathStart) {
          setPathStart(memberId);
          toast.info("Now shift-click another member to see the relationship");
        } else if (pathStart !== memberId) {
          setPathEnd(memberId);
        }
        return;
      }

      // Normal click: select member
      setSelectedMemberId(memberId);
    },
    [pathStart]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedMemberId(null);
  }, []);

  const handleMemberAdded = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleSelectMemberFromPanel = useCallback(
    (id: string) => {
      setSelectedMemberId(id);
      // Center on the node
      const node = nodes.find((n) => n.id === id);
      if (node) {
        fitView({
          nodes: [node],
          padding: 0.5,
          duration: 300,
        });
      }
    },
    [nodes, fitView]
  );

  const handleSearchSelect = useCallback(
    (memberId: string) => {
      setSelectedMemberId(memberId);
      setShowSearch(false);
      const node = nodes.find((n) => n.id === memberId);
      if (node) {
        fitView({
          nodes: [node],
          padding: 0.5,
          duration: 300,
        });
      }
    },
    [nodes, fitView]
  );

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  return (
    <div className="w-full h-full relative">
      <TooltipProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} color="oklch(0.8 0.01 75 / 0.3)" />
          <MiniMap
            nodeStrokeWidth={3}
            className="!bg-background/80 !border !border-border !rounded-lg !shadow-sm"
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
            onClose={() => setSelectedMemberId(null)}
            onEdit={() => setEditingMember(selectedMember)}
            onDelete={() => setDeleteTarget(selectedMember)}
            onSelectMember={handleSelectMemberFromPanel}
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
