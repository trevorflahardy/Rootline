import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Mock auth to return null userId (unauthenticated)
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
  currentUser: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/actions/profile", () => ({
  ensureProfile: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/rate-limit-config", () => ({
  RATE_LIMITS: new Proxy({}, { get: () => [100, 60_000] }),
}));

// Inline mock client (do NOT import from ./setup as it has its own vi.mock calls)
const mockClient = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "" } }),
    }),
  },
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockClient,
}));

// Import actions that use getAuthUser
import { createMember, updateMember, deleteMember, getMembersByTreeId } from "../member";
import { createTree } from "../tree";
import { uploadPhoto, getPhotosByTreeId, deletePhoto } from "../photo";
import { importGedcomData } from "../import";
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from "../notification";
import { getOwnedTreesForMerge, previewMerge, mergeTree } from "../merge";

const validUuid = "550e8400-e29b-41d4-a716-446655440000";
const validUuid2 = "660e8400-e29b-41d4-a716-446655440000";

describe("unauthenticated access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("member actions", () => {
    it("createMember throws Unauthorized", async () => {
      await expect(createMember({ tree_id: validUuid, first_name: "Jane" })).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("updateMember throws Unauthorized", async () => {
      await expect(updateMember(validUuid, validUuid, { first_name: "Jane" })).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("deleteMember throws Unauthorized", async () => {
      await expect(deleteMember(validUuid, validUuid)).rejects.toThrow("Unauthorized");
    });

    it("getMembersByTreeId throws Unauthorized", async () => {
      await expect(getMembersByTreeId(validUuid)).rejects.toThrow("Unauthorized");
    });
  });

  describe("tree actions", () => {
    it("createTree throws Unauthorized", async () => {
      await expect(createTree({ name: "Test Tree" })).rejects.toThrow("Unauthorized");
    });
  });

  describe("photo actions", () => {
    it("uploadPhoto throws Unauthorized", async () => {
      const fd = new FormData();
      await expect(uploadPhoto(fd, validUuid)).rejects.toThrow("Unauthorized");
    });

    it("getPhotosByTreeId throws Unauthorized", async () => {
      await expect(getPhotosByTreeId(validUuid)).rejects.toThrow("Unauthorized");
    });

    it("deletePhoto throws Unauthorized", async () => {
      await expect(deletePhoto(validUuid, validUuid)).rejects.toThrow("Unauthorized");
    });
  });

  describe("import actions", () => {
    it("importGedcomData throws Unauthorized", async () => {
      await expect(importGedcomData(validUuid, [], [])).rejects.toThrow("Unauthorized");
    });
  });

  describe("notification actions", () => {
    it("getNotifications throws Unauthorized", async () => {
      await expect(getNotifications()).rejects.toThrow("Unauthorized");
    });

    it("getUnreadCount throws Unauthorized", async () => {
      await expect(getUnreadCount()).rejects.toThrow("Unauthorized");
    });

    it("markAsRead throws Unauthorized", async () => {
      await expect(markAsRead("notif-1")).rejects.toThrow("Unauthorized");
    });

    it("markAllAsRead throws Unauthorized", async () => {
      await expect(markAllAsRead()).rejects.toThrow("Unauthorized");
    });
  });

  describe("merge actions", () => {
    it("getOwnedTreesForMerge throws Unauthorized", async () => {
      await expect(getOwnedTreesForMerge(validUuid)).rejects.toThrow("Unauthorized");
    });

    it("previewMerge throws Unauthorized", async () => {
      await expect(previewMerge(validUuid, validUuid2)).rejects.toThrow("Unauthorized");
    });

    it("mergeTree throws Unauthorized", async () => {
      await expect(mergeTree(validUuid, validUuid2, [])).rejects.toThrow("Unauthorized");
    });
  });
});
