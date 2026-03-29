/**
 * Centralized rate limit configurations: [maxCalls, windowMs]
 *
 * Naming convention matches the action function names so spreading
 * into `rateLimit(userId, 'actionName', ...RATE_LIMITS.actionName)` reads naturally.
 */
export const RATE_LIMITS = {
  // ── Tree operations ───────────────────────────────────────────────────────
  createTree: [5, 60_000] as const,
  updateTree: [20, 60_000] as const,
  deleteTree: [3, 60_000] as const,

  // ── Member operations ─────────────────────────────────────────────────────
  createMember: [20, 60_000] as const,
  updateMember: [30, 60_000] as const,
  deleteMember: [10, 60_000] as const,
  getMembersWithStats: [30, 60_000] as const,

  // ── Relationship operations ───────────────────────────────────────────────
  createRelationship: [30, 60_000] as const,
  updateRelationship: [60, 60_000] as const,
  deleteRelationship: [30, 60_000] as const,

  // ── Photo operations ──────────────────────────────────────────────────────
  uploadPhoto: [10, 60_000] as const,

  // ── Document operations ───────────────────────────────────────────────────
  uploadDocument: [10, 60_000] as const,

  // ── Import operations ─────────────────────────────────────────────────────
  importGedcom: [5, 60_000] as const,

  // ── Invite operations ─────────────────────────────────────────────────────
  createInvite: [5, 60_000] as const,
  acceptInvite: [10, 60_000] as const,

  // ── Merge (destructive) ───────────────────────────────────────────────────
  mergeTree: [3, 60_000] as const,

  // ── Snapshot / rollback (audit.ts) ────────────────────────────────────────
  createSnapshot: [5, 60_000] as const,
  rollbackToSnapshot: [3, 60_000] as const,

  // ── Permissions (permissions.ts) ──────────────────────────────────────────
  bulkUpdateRoles: [5, 60_000] as const,
  bulkRevokeMemberships: [3, 60_000] as const,
  revokeMembership: [10, 60_000] as const,

  // ── Read-only / light endpoints ───────────────────────────────────────────
  getBirthdayReminders: [30, 60_000] as const,
  getTimelineEvents: [30, 60_000] as const,
  getTreeStats: [30, 60_000] as const,
  getTreeHealth: [30, 60_000] as const,
  getAuditLog: [30, 60_000] as const,

  // ── Notification write operations ─────────────────────────────────────────
  markAsRead: [60, 60_000] as const,
  markAllAsRead: [10, 60_000] as const,
} satisfies Record<string, readonly [number, number]>;
