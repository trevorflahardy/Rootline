"use client";

import { useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";
import {
  computeTreeLayout,
  NODE_WIDTH,
  NODE_HEIGHT,
  type CoParentGroup,
  type LayoutNode,
  type LayoutEdge,
} from "@/lib/utils/tree-layout";
import type { MemberNodeData } from "../member-node";
import type { TreeMember, Relationship } from "@/types";
import type { NodeProfileLink } from "@/lib/actions/permissions";

interface TreeLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  coParentGroups: CoParentGroup[];
}

export function useTreeLayout(
  members: TreeMember[],
  relationships: Relationship[],
  joinEnabledMap: Record<string, boolean>,
  nodeProfileMap: Record<string, NodeProfileLink>
) {
  const layout: TreeLayout = useMemo(
    () => computeTreeLayout(members, relationships, new Map(Object.entries(joinEnabledMap))),
    [members, relationships, joinEnabledMap]
  );

  const initialNodes: Node[] = useMemo(() => {
    return layout.nodes.map((n) => {
      const member = n.data as TreeMember;
      const hasSavedPosition = member.position_x != null && member.position_y != null;
      return {
        ...n,
        position: hasSavedPosition ? { x: member.position_x!, y: member.position_y! } : n.position,
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

  return { layout, initialNodes, initialEdges };
}

export { NODE_WIDTH, NODE_HEIGHT };
export type { CoParentGroup };
