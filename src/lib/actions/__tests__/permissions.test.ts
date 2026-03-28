import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "user-owner" }),
  currentUser: vi.fn().mockResolvedValue({
    fullName: "Owner User",
    firstName: "Owner",
    emailAddresses: [{ emailAddress: "owner@example.com" }],
    imageUrl: null,
  }),
}));
vi.mock("@/lib/actions/profile", () => ({
  ensureProfile: vi.fn(),
}));

const validTreeId = "550e8400-e29b-41d4-a716-446655440000";
const membershipId1 = "membership-1";
const membershipId2 = "membership-2";
const ownerMembershipId = "membership-owner";

function makeMockClient() {
  const client = {
    from: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return client;
}

const mockClient = makeMockClient();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockClient,
}));

import {
  revokeMembership,
  bulkUpdateRoles,
  bulkRevokeMemberships,
  getTreeMembershipsWithActivity,
} from "../permissions";

// Helper that builds a chainable mock matching the Supabase query builder pattern
function mockChain(singleResult: { data: unknown; error: unknown } = { data: null, error: null }) {
  const self = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    single: vi.fn().mockResolvedValue(singleResult),
  };
  // All chainable methods return self
  self.select.mockReturnValue(self);
  self.eq.mockReturnValue(self);
  self.neq.mockReturnValue(self);
  self.in.mockReturnValue(self);
  self.not.mockReturnValue(self);
  self.order.mockReturnValue(self);
  self.limit.mockReturnValue(self);
  self.delete.mockReturnValue(self);
  self.update.mockReturnValue(self);
  return self;
}

describe("revokeMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows owner to revoke an editor membership", async () => {
    const callerChain = mockChain({
      data: { role: "owner", id: ownerMembershipId },
      error: null,
    });
    const targetChain = mockChain({
      data: { role: "editor" },
      error: null,
    });
    const deleteChain = mockChain();

    let callCount = 0;
    mockClient.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return callerChain;
      if (callCount === 2) return targetChain;
      return deleteChain;
    });

    await expect(
      revokeMembership(validTreeId, membershipId1)
    ).resolves.toBeUndefined();
  });

  it("rejects non-owner from revoking", async () => {
    const callerChain = mockChain({
      data: { role: "editor", id: "some-id" },
      error: null,
    });

    mockClient.from.mockImplementation(() => callerChain);

    await expect(
      revokeMembership(validTreeId, membershipId1)
    ).rejects.toThrow("Only the tree owner can revoke memberships");
  });

  it("prevents owner from revoking self", async () => {
    const callerChain = mockChain({
      data: { role: "owner", id: ownerMembershipId },
      error: null,
    });

    mockClient.from.mockImplementation(() => callerChain);

    await expect(
      revokeMembership(validTreeId, ownerMembershipId)
    ).rejects.toThrow("Cannot revoke your own membership");
  });

  it("prevents revoking another owner", async () => {
    const callerChain = mockChain({
      data: { role: "owner", id: ownerMembershipId },
      error: null,
    });
    const targetChain = mockChain({
      data: { role: "owner" },
      error: null,
    });

    let callCount = 0;
    mockClient.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return callerChain;
      return targetChain;
    });

    await expect(
      revokeMembership(validTreeId, "other-owner-membership")
    ).rejects.toThrow("Cannot revoke owner membership");
  });
});

describe("bulkUpdateRoles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates multiple memberships when called by owner", async () => {
    const callerChain = mockChain({
      data: { role: "owner" },
      error: null,
    });
    const updateChain = mockChain();

    let callCount = 0;
    mockClient.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return callerChain;
      return updateChain;
    });

    await expect(
      bulkUpdateRoles(validTreeId, [membershipId1, membershipId2], "viewer")
    ).resolves.toBeUndefined();
  });

  it("rejects non-owner from bulk updating", async () => {
    const callerChain = mockChain({
      data: { role: "viewer" },
      error: null,
    });

    mockClient.from.mockImplementation(() => callerChain);

    await expect(
      bulkUpdateRoles(validTreeId, [membershipId1], "editor")
    ).rejects.toThrow("Only the tree owner can bulk update roles");
  });
});

describe("bulkRevokeMemberships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes multiple memberships when called by owner", async () => {
    const callerChain = mockChain({
      data: { role: "owner", id: ownerMembershipId },
      error: null,
    });
    const deleteChain = mockChain();

    let callCount = 0;
    mockClient.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return callerChain;
      return deleteChain;
    });

    await expect(
      bulkRevokeMemberships(validTreeId, [membershipId1, membershipId2])
    ).resolves.toBeUndefined();
  });

  it("rejects non-owner from bulk revoking", async () => {
    const callerChain = mockChain({
      data: { role: "editor", id: "some-id" },
      error: null,
    });

    mockClient.from.mockImplementation(() => callerChain);

    await expect(
      bulkRevokeMemberships(validTreeId, [membershipId1])
    ).rejects.toThrow("Only the tree owner can bulk revoke memberships");
  });
});

describe("getTreeMembershipsWithActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns memberships with activity data", async () => {
    const accessChain = mockChain({
      data: { role: "owner" },
      error: null,
    });

    const membershipsData = [
      {
        id: "m1",
        tree_id: validTreeId,
        user_id: "user-1",
        role: "editor",
        linked_node_id: null,
        joined_at: "2026-01-01T00:00:00Z",
        profiles: { display_name: "User One", email: "one@test.com", avatar_url: null },
      },
    ];

    const membershipListChain = mockChain();
    // Override eq to return a chainable object with limit that resolves
    membershipListChain.eq.mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: membershipsData, error: null }),
    });

    const logsData = [
      { user_id: "user-1", created_at: "2026-03-22T10:00:00Z" },
    ];

    const logsChain = mockChain();
    logsChain.order.mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: logsData, error: null }),
    });

    let callCount = 0;
    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        callCount++;
        if (callCount === 1) return accessChain;
        return membershipListChain;
      }
      if (table === "audit_logs") {
        return logsChain;
      }
      return mockChain();
    });

    const result = await getTreeMembershipsWithActivity(validTreeId);
    expect(result).toHaveLength(1);
    expect(result[0].last_active).toBe("2026-03-22T10:00:00Z");
    expect(result[0].profile?.display_name).toBe("User One");
  });
});
