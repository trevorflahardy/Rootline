"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Connection, OnConnectStart, OnConnectEnd, Node } from "@xyflow/react";
import { toast } from "sonner";
import { createRelationship } from "@/lib/actions/relationship";
import type { CoupleBlockNodeData } from "../couple-block-node";
import type { TreeMember } from "@/types";

interface UseTreeConnectionsParams {
  canEdit: boolean;
  treeId: string;
  members: TreeMember[];
  nodesRef: React.MutableRefObject<Node[]>;
  pendingSecondParentRef: React.MutableRefObject<string | null>;
  setAddMemberDefaults: React.Dispatch<
    React.SetStateAction<{
      relatedMemberId: string;
      relationshipDirection: "parent" | "child" | "spouse";
    } | null>
  >;
  setShowAddDialog: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useTreeConnections({
  canEdit,
  treeId,
  members,
  nodesRef,
  pendingSecondParentRef,
  setAddMemberDefaults,
  setShowAddDialog,
}: UseTreeConnectionsParams) {
  const router = useRouter();
  const pendingConnectStartRef = useRef<{ nodeId: string | null; handleId: string | null } | null>(
    null
  );

  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!canEdit || !connection.source || !connection.target) return;
      if (connection.sourceHandle === "couple-bottom") {
        const blockNode = nodesRef.current.find((n) => n.id === connection.source);
        if (!blockNode) return;
        const blockData = blockNode.data as CoupleBlockNodeData;
        try {
          await Promise.all([
            createRelationship({
              tree_id: treeId,
              from_member_id: blockData.parent1Id,
              to_member_id: connection.target,
              relationship_type: "parent_child",
            }),
            createRelationship({
              tree_id: treeId,
              from_member_id: blockData.parent2Id,
              to_member_id: connection.target,
              relationship_type: "parent_child",
            }),
          ]);
          toast.success("Child linked to both parents");
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to link child");
        }
        return;
      }
      const isSpouseConnect =
        connection.sourceHandle === "right" || connection.targetHandle === "left";
      try {
        await createRelationship({
          tree_id: treeId,
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
    [canEdit, treeId, router, nodesRef]
  );

  const handleConnectStart = useCallback<OnConnectStart>((_event, params) => {
    pendingConnectStartRef.current = { nodeId: params.nodeId, handleId: params.handleId };
  }, []);

  const handleConnectEnd = useCallback<OnConnectEnd>(
    (_event, connectionState) => {
      const start = pendingConnectStartRef.current;
      pendingConnectStartRef.current = null;
      if (!canEdit || !start?.nodeId) return;
      if (connectionState.toNode) return;
      if (start.handleId === "couple-bottom") {
        const blockNode = nodesRef.current.find((n) => n.id === start.nodeId);
        if (!blockNode) return;
        const blockData = blockNode.data as CoupleBlockNodeData;
        pendingSecondParentRef.current = blockData.parent2Id;
        setAddMemberDefaults({
          relatedMemberId: blockData.parent1Id,
          relationshipDirection: "child",
        });
        setShowAddDialog(true);
        return;
      }
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
      setAddMemberDefaults({ relatedMemberId: start.nodeId, relationshipDirection });
      setShowAddDialog(true);
    },
    [canEdit, members, nodesRef, pendingSecondParentRef, setAddMemberDefaults, setShowAddDialog]
  );

  return { handleConnect, handleConnectStart, handleConnectEnd };
}
