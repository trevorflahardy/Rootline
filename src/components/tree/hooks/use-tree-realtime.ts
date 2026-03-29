"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { createRelationship } from "@/lib/actions/relationship";
import type { TreeMember, Relationship } from "@/types";

type CollaboratorLock = {
  memberId: string;
  field: string;
};

export type CollaboratorPresence = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  color: string;
  selectedMemberId: string | null;
  editingLock: CollaboratorLock | null;
};

export type CollaboratorCursor = {
  userId: string;
  x: number;
  y: number;
  ts: number;
};

export function colorFromUserId(userId: string): string {
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

interface UseTreeRealtimeParams {
  treeId: string;
  currentUserId: string;
  currentUserName?: string | null;
  currentUserAvatarUrl?: string | null;
  selectedMemberId: string | null;
  activeEditLock: CollaboratorLock | null;
  setMembers: React.Dispatch<React.SetStateAction<TreeMember[]>>;
  setRelationships: React.Dispatch<React.SetStateAction<Relationship[]>>;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedMemberId: React.Dispatch<React.SetStateAction<string | null>>;
  pendingSecondParentRef: React.MutableRefObject<string | null>;
}

export function useTreeRealtime({
  treeId,
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
}: UseTreeRealtimeParams) {
  const router = useRouter();
  const [remoteCollaborators, setRemoteCollaborators] = useState<
    Record<string, CollaboratorPresence>
  >({});
  const [remoteCursors, setRemoteCursors] = useState<Record<string, CollaboratorCursor>>({});
  const collaborationChannelRef = useRef<ReturnType<
    ReturnType<typeof createBrowserClient>["channel"]
  > | null>(null);
  const cursorSentAtRef = useRef(0);
  const selfColor = useMemo(() => colorFromUserId(currentUserId || "anonymous"), [currentUserId]);
  const resolvedCurrentUserName = useMemo(
    () => currentUserName?.trim() || "You",
    [currentUserName]
  );

  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase.channel(`tree-live-${treeId}`, {
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
          filter: `tree_id=eq.${treeId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as TreeMember;
          if (!row?.id) return;

          if (payload.eventType === "INSERT") {
            setMembers((prev) => {
              if (prev.some((member) => member.id === row.id)) return prev;
              const secondParentId = pendingSecondParentRef.current;
              if (secondParentId) {
                pendingSecondParentRef.current = null;
                createRelationship({
                  tree_id: treeId,
                  from_member_id: secondParentId,
                  to_member_id: row.id,
                  relationship_type: "parent_child",
                })
                  .then(() => router.refresh())
                  .catch(() => {});
              }
              return [...prev, row];
            });
            return;
          }

          if (payload.eventType === "UPDATE") {
            setMembers((prev) =>
              prev.map((member) => (member.id === row.id ? { ...member, ...row } : member))
            );
            return;
          }

          if (payload.eventType === "DELETE") {
            setMembers((prev) => prev.filter((member) => member.id !== row.id));
            setRelationships((prev) =>
              prev.filter((rel) => rel.from_member_id !== row.id && rel.to_member_id !== row.id)
            );
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
          filter: `tree_id=eq.${treeId}`,
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
            setRelationships((prev) =>
              prev.map((rel) => (rel.id === row.id ? { ...rel, ...row } : rel))
            );
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
        setMembers((prev) =>
          prev.map((existing) =>
            existing.id === member.id ? { ...existing, ...member } : existing
          )
        );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setState/ref/router are stable and must not trigger channel reconnection
  }, [currentUserAvatarUrl, currentUserId, resolvedCurrentUserName, selfColor, treeId]);

  useEffect(() => {
    const channel = collaborationChannelRef.current;
    if (!channel) return;

    channel
      .track({
        userId: currentUserId,
        name: resolvedCurrentUserName,
        avatarUrl: currentUserAvatarUrl ?? null,
        color: selfColor,
        selectedMemberId,
        editingLock: activeEditLock,
      } as CollaboratorPresence)
      .catch(() => {});
  }, [
    activeEditLock,
    currentUserAvatarUrl,
    currentUserId,
    resolvedCurrentUserName,
    selectedMemberId,
    selfColor,
  ]);

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

  const sendCursor = (event: React.MouseEvent<HTMLDivElement>) => {
    const channel = collaborationChannelRef.current;
    if (!channel || !currentUserId) return;

    const now = Date.now();
    if (now - cursorSentAtRef.current < 40) return;
    cursorSentAtRef.current = now;

    if (channel.state !== "joined") return;
    const rect = event.currentTarget.getBoundingClientRect();
    channel
      .send({
        type: "broadcast",
        event: "cursor",
        payload: {
          userId: currentUserId,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          ts: now,
        } satisfies CollaboratorCursor,
      })
      .catch(() => {});
  };

  const sendCursorLeave = () => {
    const channel = collaborationChannelRef.current;
    if (!channel || !currentUserId || channel.state !== "joined") return;
    channel
      .send({
        type: "broadcast",
        event: "cursor",
        payload: {
          userId: currentUserId,
          x: -1000,
          y: -1000,
          ts: Date.now(),
        } satisfies CollaboratorCursor,
      })
      .catch(() => {});
  };

  const broadcastMemberUpdate = (updatedMember: TreeMember) => {
    const channel = collaborationChannelRef.current;
    if (!channel || channel.state !== "joined") return;
    channel
      .send({
        type: "broadcast",
        event: "member-updated",
        payload: updatedMember,
      })
      .catch(() => {});
  };

  return {
    remoteCollaborators,
    remoteCursors,
    selfColor,
    sendCursor,
    sendCursorLeave,
    broadcastMemberUpdate,
  };
}
