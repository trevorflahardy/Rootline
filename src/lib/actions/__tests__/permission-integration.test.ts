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

const validTreeId = "550e8400-e29b-41d4-a716-446655440000";
const validFromMemberId = "660e8400-e29b-41d4-a716-446655440001";
const validToMemberId = "770e8400-e29b-41d4-a716-446655440002";
const validMemberId = "880e8400-e29b-41d4-a716-446655440003";
const linkedNodeId = "990e8400-e29b-41d4-a716-446655440004";
const membershipId1 = "aa0e8400-e29b-41d4-a716-446655440005";
const membershipId2 = "bb0e8400-e29b-41d4-a716-446655440006";
const ownerMembershipId = "cc0e8400-e29b-41d4-a716-446655440007";

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

import { createRelationship } from "../relationship";
import { createMember, updateMember, deleteMember } from "../member";
import { revokeMembership, bulkUpdateRoles } from "../permissions";

/**
 * Helper to set up mockClient.from for a given role and optional linked_node_id.
 * Returns the membership data on tree_memberships select, and allows
 * configuring behavior for other tables via overrides.
 */
function mockMembershipRole(
  role: string,
  linked_node_id: string | null = null,
  overrides?: Record<string, () => Record<string, unknown>>
) {
  mockClient.from.mockImplementation((table: string) => {
    if (overrides && overrides[table]) {
      return overrides[table]();
    }
    if (table === "tree_memberships") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role, linked_node_id },
                error: null,
              }),
            }),
          }),
        }),
      };
    }
    // Default for other tables: return successful insert/update/delete
    return {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "new-id" }, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "updated-id" }, error: null }),
            }),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ error: null }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    };
  });
}

describe("Permission Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scoped editor cannot create relationship outside their branch", async () => {
    mockMembershipRole("editor", linkedNodeId);
    // Both from and to members are NOT descendants of linked node
    mockClient.rpc.mockResolvedValue({ data: false, error: null });

    await expect(
      createRelationship({
        tree_id: validTreeId,
        from_member_id: validFromMemberId,
        to_member_id: validToMemberId,
        relationship_type: "parent_child",
      })
    ).rejects.toThrow("You can only create relationships within your branch");
  });

  it("scoped editor can create relationship within their branch", async () => {
    const mockRelationship = {
      id: "rel-1",
      tree_id: validTreeId,
      from_member_id: validFromMemberId,
      to_member_id: validToMemberId,
      relationship_type: "parent_child",
      start_date: null,
      end_date: null,
      created_at: "2026-01-01T00:00:00Z",
    };

    mockMembershipRole("editor", linkedNodeId, {
      relationships: () => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockRelationship, error: null }),
          }),
        }),
      }),
    });
    // Promise.all calls is_descendant_of for from + to first, then set_request_user_id after
    mockClient.rpc
      .mockResolvedValueOnce({ data: true, error: null }) // from is descendant
      .mockResolvedValueOnce({ data: true, error: null }) // to is descendant
      .mockResolvedValueOnce({ data: null, error: null }); // set_request_user_id

    const result = await createRelationship({
      tree_id: validTreeId,
      from_member_id: validFromMemberId,
      to_member_id: validToMemberId,
      relationship_type: "parent_child",
    });

    expect(result).toBeDefined();
    expect(result.relationship_type).toBe("parent_child");
  });

  it("viewer cannot create member", async () => {
    mockMembershipRole("viewer");

    await expect(createMember({ tree_id: validTreeId, first_name: "Jane" })).rejects.toThrow(
      "Viewers cannot add members"
    );
  });

  it("viewer cannot create relationship", async () => {
    mockMembershipRole("viewer");

    await expect(
      createRelationship({
        tree_id: validTreeId,
        from_member_id: validFromMemberId,
        to_member_id: validToMemberId,
        relationship_type: "spouse",
      })
    ).rejects.toThrow("Viewers cannot add relationships");
  });

  it("viewer cannot delete member", async () => {
    mockMembershipRole("viewer");

    await expect(deleteMember(validMemberId, validTreeId)).rejects.toThrow(
      "Viewers cannot delete members"
    );
  });

  it("owner can perform all operations (create member)", async () => {
    const mockMember = {
      id: "member-new",
      tree_id: validTreeId,
      first_name: "OwnerCreated",
      last_name: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    mockMembershipRole("owner", null, {
      tree_members: () => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockMember, error: null }),
          }),
        }),
      }),
    });
    mockClient.rpc.mockResolvedValue({ data: null, error: null });

    const result = await createMember({ tree_id: validTreeId, first_name: "OwnerCreated" });
    expect(result.first_name).toBe("OwnerCreated");
  });

  it("role change from editor to viewer removes edit ability", async () => {
    // First: owner changes role (succeeds)
    // We'll test that after the role is viewer, updateMember fails
    mockMembershipRole("viewer");

    await expect(
      updateMember(validMemberId, validTreeId, { first_name: "Changed" })
    ).rejects.toThrow("Viewers cannot edit members");
  });

  it("revoking membership prevents access (no membership found)", async () => {
    // After revocation, membership query returns no data
    mockClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116", message: "No rows found" },
            }),
          }),
        }),
      }),
    }));

    await expect(createMember({ tree_id: validTreeId, first_name: "ShouldFail" })).rejects.toThrow(
      "No access to this tree"
    );
  });

  it("bulk role update only affects specified memberships", async () => {
    // Mock: caller is owner
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          neq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: "owner" },
                  error: null,
                }),
              }),
            }),
          }),
          update: updateFn,
        };
      }
      return {};
    });

    await bulkUpdateRoles(validTreeId, [membershipId1, membershipId2], "viewer");

    // Verify update was called
    expect(updateFn).toHaveBeenCalledWith({ role: "viewer" });
  });

  it("cannot revoke owner's membership", async () => {
    // Caller is also owner, target is owner
    let callCount = 0;
    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockImplementation(() => {
                  callCount++;
                  if (callCount === 1) {
                    // Caller membership
                    return Promise.resolve({
                      data: { role: "owner", id: ownerMembershipId },
                      error: null,
                    });
                  }
                  // Target membership (also owner)
                  return Promise.resolve({
                    data: { role: "owner" },
                    error: null,
                  });
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(revokeMembership(validTreeId, "some-other-owner-membership")).rejects.toThrow(
      "Cannot revoke owner membership"
    );
  });
});
