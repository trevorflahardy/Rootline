"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/actions/auth";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/rate-limit-config";

export interface Notification {
  id: string;
  tree_id: string;
  user_id: string;
  type: string;
  message: string;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
  actor: {
    clerk_id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  subject_members: Array<{
    id: string;
    name: string;
    avatar_url: string | null;
  }>;
  relationship_type: string | null;
}

interface NotificationRow {
  id: string;
  tree_id: string;
  user_id: string;
  type: string;
  message: string;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

interface AuditLookupRow {
  entity_id: string;
  user_id: string | null;
  entity_type: string;
  created_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

export async function getNotifications(limit = 20): Promise<Notification[]> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch notifications: ${error.message}`);

  const notifications = (data ?? []) as NotificationRow[];
  if (notifications.length === 0) return [];

  const entityIds = [
    ...new Set(notifications.map((n) => n.entity_id).filter((id): id is string => !!id)),
  ];

  let auditRows: AuditLookupRow[] = [];
  if (entityIds.length > 0) {
    const { data: auditData } = await supabase
      .from("audit_log")
      .select("entity_id, user_id, entity_type, created_at, old_data, new_data")
      .in("entity_id", entityIds)
      .order("created_at", { ascending: false });

    auditRows = (auditData ?? []) as AuditLookupRow[];
  }

  const auditByEntity = new Map<string, AuditLookupRow[]>();
  for (const row of auditRows) {
    const list = auditByEntity.get(row.entity_id) ?? [];
    list.push(row);
    auditByEntity.set(row.entity_id, list);
  }

  const actorIds = new Set<string>();
  const memberIds = new Set<string>();

  const matchedAuditByNotificationId = new Map<string, AuditLookupRow | null>();

  for (const notification of notifications) {
    const entityId = notification.entity_id;
    if (!entityId) {
      matchedAuditByNotificationId.set(notification.id, null);
      continue;
    }

    const candidates = auditByEntity.get(entityId) ?? [];
    const matched =
      candidates.find((row) => row.created_at <= notification.created_at) ?? candidates[0] ?? null;
    matchedAuditByNotificationId.set(notification.id, matched);

    if (matched?.user_id) actorIds.add(matched.user_id);

    if (notification.type.startsWith("member_") && entityId) {
      memberIds.add(entityId);
    }

    const relData = (matched?.new_data ?? matched?.old_data) as Record<string, unknown> | null;
    const fromId = typeof relData?.from_member_id === "string" ? relData.from_member_id : null;
    const toId = typeof relData?.to_member_id === "string" ? relData.to_member_id : null;
    if (fromId) memberIds.add(fromId);
    if (toId) memberIds.add(toId);
  }

  const [profilesResult, membersResult] = await Promise.all([
    actorIds.size > 0
      ? supabase
          .from("profiles")
          .select("clerk_id, display_name, avatar_url")
          .in("clerk_id", Array.from(actorIds))
      : Promise.resolve({ data: [], error: null }),
    memberIds.size > 0
      ? supabase
          .from("tree_members")
          .select("id, first_name, last_name, avatar_url")
          .in("id", Array.from(memberIds))
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profileMap = new Map(
    (
      (profilesResult.data ?? []) as Array<{
        clerk_id: string;
        display_name: string;
        avatar_url: string | null;
      }>
    ).map((profile) => [profile.clerk_id, profile])
  );

  const memberMap = new Map(
    (
      (membersResult.data ?? []) as Array<{
        id: string;
        first_name: string;
        last_name: string | null;
        avatar_url: string | null;
      }>
    ).map((member) => [
      member.id,
      {
        id: member.id,
        name: `${member.first_name}${member.last_name ? ` ${member.last_name}` : ""}`,
        avatar_url: member.avatar_url,
      },
    ])
  );

  return notifications.map((notification) => {
    const matchedAudit = matchedAuditByNotificationId.get(notification.id) ?? null;
    const actor = matchedAudit?.user_id ? (profileMap.get(matchedAudit.user_id) ?? null) : null;

    const subjectMembers: Array<{ id: string; name: string; avatar_url: string | null }> = [];

    if (notification.type.startsWith("member_") && notification.entity_id) {
      const member = memberMap.get(notification.entity_id);
      if (member) subjectMembers.push(member);
    }

    const relData = (matchedAudit?.new_data ?? matchedAudit?.old_data) as Record<
      string,
      unknown
    > | null;
    const fromId = typeof relData?.from_member_id === "string" ? relData.from_member_id : null;
    const toId = typeof relData?.to_member_id === "string" ? relData.to_member_id : null;
    if (fromId) {
      const member = memberMap.get(fromId);
      if (member && !subjectMembers.some((m) => m.id === member.id)) subjectMembers.push(member);
    }
    if (toId) {
      const member = memberMap.get(toId);
      if (member && !subjectMembers.some((m) => m.id === member.id)) subjectMembers.push(member);
    }

    return {
      ...notification,
      actor,
      subject_members: subjectMembers,
      relationship_type:
        typeof relData?.relationship_type === "string" ? relData.relationship_type : null,
    };
  });
}

export async function getUnreadCount(): Promise<number> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) return 0;
  return count ?? 0;
}

export async function markAsRead(notificationId: string): Promise<void> {
  const userId = await getAuthUser();
  rateLimit(userId, "markAsRead", ...RATE_LIMITS.markAsRead);
  const supabase = createAdminClient();

  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);
}

export async function markAllAsRead(): Promise<void> {
  const userId = await getAuthUser();
  rateLimit(userId, "markAllAsRead", ...RATE_LIMITS.markAllAsRead);
  const supabase = createAdminClient();

  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
}
