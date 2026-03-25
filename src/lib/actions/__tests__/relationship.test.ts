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
const validUuid2 = "660e8400-e29b-41d4-a716-446655440000";
const validUuid3 = "770e8400-e29b-41d4-a716-446655440000";

const mockClient = {
  from: vi.fn(),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockClient,
}));

import { createRelationship, deleteRelationship, getRelationshipsByTreeId } from "../relationship";

describe("createRelationship", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws on invalid input (bad relationship type)", async () => {
    await expect(
      createRelationship({
        tree_id: validUuid,
        from_member_id: validUuid2,
        to_member_id: validUuid3,
        relationship_type: "friend" as "parent_child",
      })
    ).rejects.toThrow();
  });

  it("throws on invalid UUID in input", async () => {
    await expect(
      createRelationship({
        tree_id: "bad-uuid",
        from_member_id: validUuid2,
        to_member_id: validUuid3,
        relationship_type: "parent_child",
      })
    ).rejects.toThrow();
  });

  it("throws when user has no access to tree", async () => {
    mockClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }));

    await expect(
      createRelationship({
        tree_id: validUuid,
        from_member_id: validUuid2,
        to_member_id: validUuid3,
        relationship_type: "parent_child",
      })
    ).rejects.toThrow("No access to this tree");
  });

  it("throws when viewer tries to create relationship", async () => {
    mockClient.from.mockImplementation(() => ({
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

    await expect(
      createRelationship({
        tree_id: validUuid,
        from_member_id: validUuid2,
        to_member_id: validUuid3,
        relationship_type: "parent_child",
      })
    ).rejects.toThrow("Viewers cannot add relationships");
  });

  it("creates sibling relationship when user is editor", async () => {
    const mockRel = {
      id: "rel-2",
      tree_id: validUuid,
      from_member_id: validUuid2,
      to_member_id: validUuid3,
      relationship_type: "sibling",
      start_date: null,
      end_date: null,
      created_at: "2026-01-01T00:00:00Z",
    };

    mockClient.from.mockImplementation((table: string) => {
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
      if (table === "relationships") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockRel, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await createRelationship({
      tree_id: validUuid,
      from_member_id: validUuid2,
      to_member_id: validUuid3,
      relationship_type: "sibling",
    });
    expect(result.relationship_type).toBe("sibling");
  });

  it("creates guardian relationship when user is editor", async () => {
    const mockRel = {
      id: "rel-3",
      tree_id: validUuid,
      from_member_id: validUuid2,
      to_member_id: validUuid3,
      relationship_type: "guardian",
      start_date: null,
      end_date: null,
      created_at: "2026-01-01T00:00:00Z",
    };

    mockClient.from.mockImplementation((table: string) => {
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
      if (table === "relationships") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockRel, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await createRelationship({
      tree_id: validUuid,
      from_member_id: validUuid2,
      to_member_id: validUuid3,
      relationship_type: "guardian",
    });
    expect(result.relationship_type).toBe("guardian");
  });

  it("creates relationship when user is editor", async () => {
    const mockRel = {
      id: "rel-1",
      tree_id: validUuid,
      from_member_id: validUuid2,
      to_member_id: validUuid3,
      relationship_type: "parent_child",
      start_date: null,
      end_date: null,
      created_at: "2026-01-01T00:00:00Z",
    };

    mockClient.from.mockImplementation((table: string) => {
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
      if (table === "relationships") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockRel, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await createRelationship({
      tree_id: validUuid,
      from_member_id: validUuid2,
      to_member_id: validUuid3,
      relationship_type: "parent_child",
    });
    expect(result.relationship_type).toBe("parent_child");
    expect(result.id).toBe("rel-1");
  });

  it("rejects duplicate spouse relationship for same pair", async () => {
    mockClient.from.mockImplementation((table: string) => {
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

      if (table === "relationships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: "existing-spouse" },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }

      return {};
    });

    await expect(
      createRelationship({
        tree_id: validUuid,
        from_member_id: validUuid2,
        to_member_id: validUuid3,
        relationship_type: "spouse",
      })
    ).rejects.toThrow("A spouse relationship between these members already exists");
  });
});

describe("deleteRelationship", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when non-owner tries to delete", async () => {
    mockClient.from.mockImplementation(() => ({
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

    await expect(deleteRelationship(validUuid2, validUuid)).rejects.toThrow(
      "Only the owner can delete relationships"
    );
  });
});

describe("getRelationshipsByTreeId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when user has no access", async () => {
    mockClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }));

    await expect(getRelationshipsByTreeId(validUuid)).rejects.toThrow(
      "No access to this tree"
    );
  });
});
