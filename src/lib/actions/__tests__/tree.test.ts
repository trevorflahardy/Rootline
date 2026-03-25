import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "./setup";

// Must mock before importing the module under test
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

const validUuid = "550e8400-e29b-41d4-a716-446655440000";

const { client, builder } = createMockSupabaseClient();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => client,
}));

import { createTree, updateTree, deleteTree } from "../tree";

describe("createTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset builder chain returns
    for (const key of Object.keys(builder)) {
      if (typeof builder[key]?.mockReturnThis === "function") {
        builder[key].mockReturnThis();
      }
    }
  });

  it("throws on invalid input (empty name)", async () => {
    await expect(createTree({ name: "" })).rejects.toThrow();
  });

  it("throws on name exceeding max length", async () => {
    await expect(createTree({ name: "a".repeat(101) })).rejects.toThrow();
  });

  it("creates tree and membership on valid input", async () => {
    const mockTree = {
      id: "tree-1",
      name: "My Family",
      description: null,
      owner_id: "user-123",
      is_public: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    // First .from("family_trees").insert().select().single() => tree
    // Second .from("tree_memberships").insert() => membership
    client.from.mockImplementation((table: string) => {
      if (table === "family_trees") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockTree, error: null }),
            }),
          }),
        };
      }
      if (table === "tree_memberships") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return builder;
    });

    const result = await createTree({ name: "My Family" });
    expect(result).toEqual(mockTree);
    expect(client.from).toHaveBeenCalledWith("family_trees");
    expect(client.from).toHaveBeenCalledWith("tree_memberships");
  });

  it("throws when tree insert fails", async () => {
    client.from.mockImplementation(() => ({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "DB error" },
          }),
        }),
      }),
    }));

    await expect(createTree({ name: "Test" })).rejects.toThrow("Failed to create tree");
  });
});

describe("updateTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when non-owner tries to update", async () => {
    client.from.mockImplementation(() => ({
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
    }));

    await expect(updateTree(validUuid, { name: "New Name" })).rejects.toThrow(
      "Only the owner can update tree settings"
    );
  });

  it("throws when user has no membership", async () => {
    client.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }));

    await expect(updateTree(validUuid, { name: "New" })).rejects.toThrow(
      "Only the owner can update tree settings"
    );
  });
});

describe("deleteTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when non-owner tries to delete", async () => {
    client.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: "viewer" },
              error: null,
            }),
          }),
        }),
      }),
    }));

    await expect(deleteTree(validUuid)).rejects.toThrow("Only the owner can delete a tree");
  });
});
