import { describe, it, expect, vi, beforeEach } from "vitest";

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

function makeMockClient() {
  const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const client = {
    from: vi.fn(),
    rpc: mockRpc,
  };
  return client;
}

const mockClient = makeMockClient();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockClient,
}));

import { createMember, updateMember, deleteMember } from "../member";

describe("createMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws on invalid input (missing first_name)", async () => {
    await expect(
      createMember({ tree_id: validUuid } as Parameters<typeof createMember>[0])
    ).rejects.toThrow();
  });

  it("throws on invalid tree_id format", async () => {
    await expect(
      createMember({ tree_id: "bad-id", first_name: "Jane" })
    ).rejects.toThrow();
  });

  it("throws when viewer tries to create a member", async () => {
    mockClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: "viewer", linked_node_id: null },
              error: null,
            }),
          }),
        }),
      }),
    }));

    await expect(
      createMember({ tree_id: validUuid, first_name: "Jane" })
    ).rejects.toThrow("Viewers cannot add members");
  });

  it("creates member when user has editor role", async () => {
    const mockMember = {
      id: "member-1",
      tree_id: validUuid,
      first_name: "Jane",
      last_name: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: "editor", linked_node_id: null },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "tree_members") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockMember, error: null }),
            }),
          }),
        };
      }
      return {};
    });
    mockClient.rpc.mockResolvedValue({ data: null, error: null });

    const result = await createMember({ tree_id: validUuid, first_name: "Jane" });
    expect(result.first_name).toBe("Jane");
    expect(mockClient.from).toHaveBeenCalledWith("tree_members");
  });
});

describe("updateMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when viewer tries to update", async () => {
    mockClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: "viewer", linked_node_id: null },
              error: null,
            }),
          }),
        }),
      }),
    }));

    await expect(
      updateMember("member-1", validUuid, { first_name: "Updated" })
    ).rejects.toThrow("Viewers cannot edit members");
  });

  it("throws when editor tries to edit outside their branch", async () => {
    mockClient.from.mockImplementation(() => {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: "editor", linked_node_id: "root-node" },
                error: null,
              }),
            }),
          }),
        }),
      };
    });

    // rpc("is_descendant_of") returns false
    mockClient.rpc.mockResolvedValue({ data: false, error: null });

    await expect(
      updateMember("member-1", validUuid, { first_name: "Updated" })
    ).rejects.toThrow("You can only edit members in your branch");
  });
});

describe("deleteMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when viewer tries to delete", async () => {
    mockClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: "viewer", linked_node_id: null },
              error: null,
            }),
          }),
        }),
      }),
    }));

    await expect(deleteMember("member-1", validUuid)).rejects.toThrow(
      "Viewers cannot delete members"
    );
  });
});
