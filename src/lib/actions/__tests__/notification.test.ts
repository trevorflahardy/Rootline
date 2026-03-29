import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "./setup";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "user-123" }),
  currentUser: vi.fn().mockResolvedValue({
    fullName: "Test User",
    firstName: "Test",
    emailAddresses: [{ emailAddress: "test@example.com" }],
    imageUrl: null,
  }),
}));
vi.mock("@/lib/actions/profile", () => ({
  ensureProfile: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/rate-limit-config", () => ({
  RATE_LIMITS: new Proxy({}, { get: () => [100, 60_000] }),
}));

const { client, builder } = createMockSupabaseClient();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => client,
}));

import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from "../notification";

describe("getNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(builder)) {
      if (typeof builder[key]?.mockReturnThis === "function") {
        builder[key].mockReturnThis();
      }
    }
  });

  it("returns empty array when no notifications exist", async () => {
    builder.limit.mockResolvedValue({ data: [], error: null });

    const result = await getNotifications();

    expect(result).toEqual([]);
    expect(client.from).toHaveBeenCalledWith("notifications");
  });

  it("throws when query fails", async () => {
    builder.limit.mockResolvedValue({
      data: null,
      error: { message: "DB error" },
    });

    await expect(getNotifications()).rejects.toThrow("Failed to fetch notifications");
  });

  it("returns enriched notifications with actor and subject data", async () => {
    const notifications = [
      {
        id: "notif-1",
        tree_id: "tree-1",
        user_id: "user-123",
        type: "member_created",
        message: "A member was added",
        entity_id: "entity-1",
        is_read: false,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const auditRows = [
      {
        entity_id: "entity-1",
        user_id: "actor-1",
        entity_type: "tree_members",
        created_at: "2026-01-01T00:00:00Z",
        old_data: null,
        new_data: { first_name: "John" },
      },
    ];

    const profiles = [
      {
        clerk_id: "actor-1",
        display_name: "Actor User",
        avatar_url: null,
      },
    ];

    const members = [
      {
        id: "entity-1",
        first_name: "John",
        last_name: "Doe",
        avatar_url: null,
      },
    ];

    client.from.mockImplementation((table: string) => {
      if (table === "notifications") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: notifications,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "audit_log") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: auditRows,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: profiles,
              error: null,
            }),
          }),
        };
      }
      if (table === "tree_members") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: members,
              error: null,
            }),
          }),
        };
      }
      return builder;
    });

    const result = await getNotifications();

    expect(result).toHaveLength(1);
    expect(result[0].actor).toEqual({
      clerk_id: "actor-1",
      display_name: "Actor User",
      avatar_url: null,
    });
    expect(result[0].subject_members).toHaveLength(1);
    expect(result[0].subject_members[0].name).toBe("John Doe");
  });
});

describe("getUnreadCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(builder)) {
      if (typeof builder[key]?.mockReturnThis === "function") {
        builder[key].mockReturnThis();
      }
    }
  });

  it("returns count of unread notifications", async () => {
    client.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: 5,
            error: null,
          }),
        }),
      }),
    }));

    const result = await getUnreadCount();

    expect(result).toBe(5);
  });

  it("returns 0 on error", async () => {
    client.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: null,
            error: { message: "DB error" },
          }),
        }),
      }),
    }));

    const result = await getUnreadCount();

    expect(result).toBe(0);
  });
});

describe("markAsRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the notification for the current user", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    client.from.mockImplementation(() => ({
      update: mockUpdate,
    }));

    await markAsRead("notif-1");

    expect(client.from).toHaveBeenCalledWith("notifications");
    expect(mockUpdate).toHaveBeenCalledWith({ is_read: true });
  });
});

describe("markAllAsRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks all unread notifications as read", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    client.from.mockImplementation(() => ({
      update: mockUpdate,
    }));

    await markAllAsRead();

    expect(client.from).toHaveBeenCalledWith("notifications");
    expect(mockUpdate).toHaveBeenCalledWith({ is_read: true });
  });
});
