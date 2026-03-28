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

const mockClient = {
  from: vi.fn(),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockClient,
}));

import { createInvite, acceptInvite, revokeInvite } from "../invite";

describe("createInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws on invalid input (bad tree_id)", async () => {
    await expect(
      createInvite({ tree_id: "not-a-uuid", role: "editor", max_uses: 1 })
    ).rejects.toThrow();
  });

  it("throws when non-owner tries to create invite", async () => {
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

    await expect(
      createInvite({ tree_id: validUuid, role: "editor", max_uses: 1 })
    ).rejects.toThrow("Only tree owners can create invites");
  });

  it("creates invite when user is owner", async () => {
    const mockInvite = {
      id: "invite-1",
      tree_id: validUuid,
      invite_code: "abc123",
      created_by: "user-123",
      target_node_id: null,
      email: null,
      role: "editor",
      max_uses: 1,
      use_count: 0,
      expires_at: null,
      created_at: "2026-01-01T00:00:00Z",
    };

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
        };
      }
      if (table === "invitations") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockInvite, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await createInvite({ tree_id: validUuid, role: "editor", max_uses: 1 });
    expect(result.role).toBe("editor");
    expect(result.tree_id).toBe(validUuid);
  });
});

describe("acceptInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws on invalid invite code", async () => {
    mockClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
        }),
      }),
    }));

    await expect(acceptInvite("bad-code")).rejects.toThrow("Invalid invite code");
  });

  it("throws when invite is expired", async () => {
    const expiredInvite = {
      id: "inv-1",
      tree_id: validUuid,
      invite_code: "expired-code",
      expires_at: new Date(Date.now() - 86400000).toISOString(),
      use_count: 0,
      max_uses: 5,
      role: "editor",
      target_node_id: null,
    };

    mockClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: expiredInvite, error: null }),
        }),
      }),
    }));

    await expect(acceptInvite("expired-code")).rejects.toThrow("This invite has expired");
  });

  it("throws when invite has reached maximum uses", async () => {
    const maxedInvite = {
      id: "inv-1",
      tree_id: validUuid,
      invite_code: "maxed-code",
      expires_at: null,
      use_count: 5,
      max_uses: 5,
      role: "editor",
      target_node_id: null,
    };

    mockClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: maxedInvite, error: null }),
        }),
      }),
    }));

    await expect(acceptInvite("maxed-code")).rejects.toThrow(
      "This invite has reached its maximum uses"
    );
  });

  it("returns treeId if user is already a member", async () => {
    const validInvite = {
      id: "inv-1",
      tree_id: validUuid,
      invite_code: "valid-code",
      expires_at: null,
      use_count: 0,
      max_uses: 5,
      role: "editor",
      target_node_id: null,
    };

    let callIndex = 0;
    mockClient.from.mockImplementation((table: string) => {
      if (table === "invitations") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: validInvite, error: null }),
            }),
          }),
        };
      }
      if (table === "tree_memberships") {
        callIndex++;
        if (callIndex === 1) {
          // Check existing membership
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "existing-membership" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
      }
      return {};
    });

    const result = await acceptInvite("valid-code");
    expect(result.treeId).toBe(validUuid);
  });
});

describe("revokeInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when non-owner tries to revoke", async () => {
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

    await expect(revokeInvite("660e8400-e29b-41d4-a716-446655440001", validUuid)).rejects.toThrow(
      "Only owners can revoke invites"
    );
  });
});
