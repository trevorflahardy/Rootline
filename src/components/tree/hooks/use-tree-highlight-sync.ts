"use client";

import { useEffect } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { CollaboratorPresence } from "./use-tree-realtime";
import type { FamilyArcEdgeData } from "../family-arc-edge";
import type { EdgeHighlightMode } from "../relationship-edge";
import type { Relationship } from "@/types";

interface UseTreeHighlightSyncParams {
  selectedMemberId: string | null;
  highlightedPath: string[];
  highlightedEdges: string[];
  hoveredRelMemberId: string | null;
  remoteCollaborators: Record<string, CollaboratorPresence>;
  selectedDescendantNodeIds: Set<string>;
  selectedDescendantEdgeIds: Set<string>;
  relationships: Relationship[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

export function useTreeHighlightSync({
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
}: UseTreeHighlightSyncParams) {
  // Sync node highlights and remote collaborator selections
  useEffect(() => {
    const remoteSelectionByNode = new Map<
      string,
      { userId: string; name: string; color: string; avatarUrl: string | null }
    >();
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
      nds.map((n) => {
        if (n.type === "coupleBlock") return n;
        return {
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
        };
      })
    );
  }, [selectedMemberId, highlightedPath, remoteCollaborators, selectedDescendantNodeIds, setNodes]);

  // Sync edge highlights
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
  }, [
    highlightedEdges,
    hoveredRelMemberId,
    selectedDescendantEdgeIds,
    selectedMemberId,
    relationships,
    setEdges,
  ]);
}
