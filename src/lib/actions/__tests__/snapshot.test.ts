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

const validUuid = "550e8400-e29b-41d4-a716-446655440000";
const targetUuid = "660e8400-e29b-41d4-a716-446655440000";

const { client, builder } = createMockSupabaseClient();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => client,
}));

// merge.ts exports are what we test here (snapshot-like operations via mergeTree)
import { getOwnedTreesForMerge, previewMerge, mergeTree } from "../merge";

describe("getOwnedTreesForMerge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(builder)) {
      if (typeof builder[key]?.mockReturnThis === "function") {
        builder[key].mockReturnThis();
      }
    }
  });

  it("returns empty array when user has no other owned trees", async () => {
    client.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return builder;
    });

    const result = await getOwnedTreesForMerge(validUuid);

    expect(result).toEqual([]);
  });

  it("throws on invalid excludeTreeId", async () => {
    await expect(getOwnedTreesForMerge("bad-id")).rejects.toThrow("Invalid excludeTreeId");
  });
});

describe("previewMerge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when user is not owner of target tree", async () => {
    client.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: "editor" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return builder;
    });

    await expect(previewMerge(validUuid, targetUuid)).rejects.toThrow(
      "Only the owner can perform this action"
    );
  });

  it("throws on invalid UUID", async () => {
    await expect(previewMerge("bad-id", targetUuid)).rejects.toThrow("Invalid sourceTreeId");
  });
});

describe("mergeTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when merging a tree into itself", async () => {
    await expect(mergeTree(validUuid, validUuid, [])).rejects.toThrow(
      "Cannot merge a tree into itself"
    );
  });

  it("throws when user is not owner", async () => {
    client.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: "editor" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return builder;
    });

    await expect(mergeTree(validUuid, targetUuid, [])).rejects.toThrow(
      "Only the owner can perform this action"
    );
  });

  it("throws on invalid UUIDs", async () => {
    await expect(mergeTree("bad-id", targetUuid, [])).rejects.toThrow("Invalid sourceTreeId");

    await expect(mergeTree(validUuid, "bad-id", [])).rejects.toThrow("Invalid targetTreeId");
  });
});
