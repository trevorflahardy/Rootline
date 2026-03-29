import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "user-owner" }),
  currentUser: vi.fn().mockResolvedValue({
    fullName: "Test User",
    firstName: "Test",
    emailAddresses: [{ emailAddress: "test@example.com" }],
    imageUrl: null,
  }),
}));
vi.mock("@/lib/actions/profile", () => ({ ensureProfile: vi.fn() }));
vi.mock("@/lib/validate", () => ({ assertUUID: vi.fn() }));
vi.mock("@/lib/sanitize", () => ({ sanitizeText: (s: string) => s }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/rate-limit-config", () => ({
  RATE_LIMITS: new Proxy({}, { get: () => [100, 60_000] }),
}));

const fromMock = vi.fn();
const supabaseMock = {
  from: fromMock,
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => supabaseMock }));

import { previewMerge, mergeTree, getOwnedTreesForMerge } from "../merge";

const sourceId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const targetId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const ownerResult = { data: { role: "owner" }, error: null };
const noAccessResult = { data: null, error: null };

function ownerChain(result: typeof ownerResult | typeof noAccessResult = ownerResult) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(result),
        }),
      }),
    }),
  };
}

function listChain(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  };
}

beforeEach(() => vi.clearAllMocks());

// ── previewMerge ─────────────────────────────────────────────────────────────

describe("previewMerge", () => {
  it("returns empty array when no name+DOB matches", async () => {
    let treeMembersCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "tree_memberships") return ownerChain();
      if (table === "tree_members") {
        treeMembersCalls++;
        const data =
          treeMembersCalls === 1
            ? [{ id: "sm-1", first_name: "Alice", last_name: "Smith", date_of_birth: "1980-01-01" }]
            : [{ id: "tm-1", first_name: "Bob", last_name: "Jones", date_of_birth: "1975-05-05" }];
        return listChain(data);
      }
      return {};
    });

    expect(await previewMerge(sourceId, targetId)).toEqual([]);
  });

  it("returns conflict when member matches by name + DOB", async () => {
    let treeMembersCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "tree_memberships") return ownerChain();
      if (table === "tree_members") {
        treeMembersCalls++;
        const data =
          treeMembersCalls === 1
            ? [{ id: "sm-1", first_name: "Alice", last_name: "Smith", date_of_birth: "1980-01-01" }]
            : [
                {
                  id: "tm-1",
                  first_name: "Alice",
                  last_name: "Smith",
                  date_of_birth: "1980-01-01",
                },
              ];
        return listChain(data);
      }
      return {};
    });

    const result = await previewMerge(sourceId, targetId);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sourceMemberId: "sm-1",
      targetMemberId: "tm-1",
      sourceDisplayName: "Alice Smith",
    });
  });

  it("ignores match when date_of_birth is null", async () => {
    let treeMembersCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "tree_memberships") return ownerChain();
      if (table === "tree_members") {
        treeMembersCalls++;
        const data =
          treeMembersCalls === 1
            ? [{ id: "sm-1", first_name: "Alice", last_name: "Smith", date_of_birth: null }]
            : [{ id: "tm-1", first_name: "Alice", last_name: "Smith", date_of_birth: null }];
        return listChain(data);
      }
      return {};
    });

    expect(await previewMerge(sourceId, targetId)).toEqual([]);
  });

  it("throws when caller does not own both trees", async () => {
    let call = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        call++;
        return ownerChain(call === 1 ? ownerResult : noAccessResult);
      }
      return {};
    });

    await expect(previewMerge(sourceId, targetId)).rejects.toThrow("Only the owner");
  });
});

// ── mergeTree ────────────────────────────────────────────────────────────────

describe("mergeTree", () => {
  it("throws when source and target are the same tree", async () => {
    await expect(mergeTree(targetId, targetId, [])).rejects.toThrow(
      "Cannot merge a tree into itself"
    );
  });

  it("throws when caller does not own target tree", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "tree_memberships") return ownerChain(noAccessResult);
      return {};
    });

    await expect(mergeTree(sourceId, targetId, [])).rejects.toThrow("Only the owner");
  });

  it("copies source members into target tree", async () => {
    const insertSelectMock = vi.fn().mockResolvedValue({ data: [{ id: "new-1" }], error: null });
    const insertMock = vi.fn().mockReturnValue({ select: insertSelectMock });
    let treeMembersCalls = 0;

    fromMock.mockImplementation((table: string) => {
      if (table === "tree_memberships") return ownerChain();
      if (table === "tree_members") {
        treeMembersCalls++;
        if (treeMembersCalls === 1)
          return listChain([
            {
              id: "src-1",
              first_name: "Alice",
              last_name: "Smith",
              maiden_name: null,
              gender: "female",
              date_of_birth: "1980-01-01",
              date_of_death: null,
              birth_place: null,
              death_place: null,
              bio: null,
              is_deceased: false,
            },
          ]);
        return { insert: insertMock };
      }
      if (table === "relationships")
        return {
          select: vi
            .fn()
            .mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      if (table === "media")
        return {
          select: vi
            .fn()
            .mockReturnValue({
              eq: vi
                .fn()
                .mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
            }),
        };
      if (table === "audit_log")
        return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
      if (table === "family_trees")
        return {
          delete: vi
            .fn()
            .mockReturnValue({
              eq: vi
                .fn()
                .mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
            }),
        };
      return {};
    });

    await mergeTree(sourceId, targetId, []);
    expect(insertMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ first_name: "Alice", tree_id: targetId })])
    );
  });

  it("remaps relationship member IDs to new target IDs", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    let treeMembersCalls = 0;
    let relCalls = 0;

    fromMock.mockImplementation((table: string) => {
      if (table === "tree_memberships") return ownerChain();
      if (table === "tree_members") {
        treeMembersCalls++;
        if (treeMembersCalls === 1)
          return listChain([
            {
              id: "src-a",
              first_name: "A",
              last_name: null,
              maiden_name: null,
              gender: "unknown",
              date_of_birth: null,
              date_of_death: null,
              birth_place: null,
              death_place: null,
              bio: null,
              is_deceased: false,
            },
            {
              id: "src-b",
              first_name: "B",
              last_name: null,
              maiden_name: null,
              gender: "unknown",
              date_of_birth: null,
              date_of_death: null,
              birth_place: null,
              death_place: null,
              bio: null,
              is_deceased: false,
            },
          ]);
        return {
          insert: vi
            .fn()
            .mockReturnValue({
              select: vi
                .fn()
                .mockResolvedValue({ data: [{ id: "new-a" }, { id: "new-b" }], error: null }),
            }),
        };
      }
      if (table === "relationships") {
        relCalls++;
        if (relCalls === 1)
          return {
            select: vi
              .fn()
              .mockReturnValue({
                eq: vi
                  .fn()
                  .mockResolvedValue({
                    data: [
                      {
                        id: "r1",
                        tree_id: sourceId,
                        from_member_id: "src-a",
                        to_member_id: "src-b",
                        relationship_type: "parent_child",
                        start_date: null,
                        end_date: null,
                      },
                    ],
                    error: null,
                  }),
              }),
            upsert: upsertMock,
          };
        return { upsert: upsertMock };
      }
      if (table === "media")
        return {
          select: vi
            .fn()
            .mockReturnValue({
              eq: vi
                .fn()
                .mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
            }),
        };
      if (table === "audit_log")
        return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
      if (table === "family_trees")
        return {
          delete: vi
            .fn()
            .mockReturnValue({
              eq: vi
                .fn()
                .mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
            }),
        };
      return {};
    });

    await mergeTree(sourceId, targetId, []);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          from_member_id: "new-a",
          to_member_id: "new-b",
          tree_id: targetId,
        }),
      ]),
      expect.any(Object)
    );
  });

  it("skipped members are not copied and their relationships are dropped", async () => {
    const insertMock = vi.fn();
    let treeMembersCalls = 0;

    fromMock.mockImplementation((table: string) => {
      if (table === "tree_memberships") return ownerChain();
      if (table === "tree_members") {
        treeMembersCalls++;
        if (treeMembersCalls === 1)
          return listChain([
            {
              id: "skip-me",
              first_name: "Skip",
              last_name: null,
              maiden_name: null,
              gender: "unknown",
              date_of_birth: null,
              date_of_death: null,
              birth_place: null,
              death_place: null,
              bio: null,
              is_deceased: false,
            },
          ]);
        return { insert: insertMock };
      }
      if (table === "relationships")
        return {
          select: vi
            .fn()
            .mockReturnValue({
              eq: vi
                .fn()
                .mockResolvedValue({
                  data: [
                    {
                      id: "rx",
                      tree_id: sourceId,
                      from_member_id: "skip-me",
                      to_member_id: "other",
                      relationship_type: "parent_child",
                      start_date: null,
                      end_date: null,
                    },
                  ],
                  error: null,
                }),
            }),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      if (table === "media")
        return {
          select: vi
            .fn()
            .mockReturnValue({
              eq: vi
                .fn()
                .mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
            }),
        };
      if (table === "audit_log")
        return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
      if (table === "family_trees")
        return {
          delete: vi
            .fn()
            .mockReturnValue({
              eq: vi
                .fn()
                .mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
            }),
        };
      return {};
    });

    await mergeTree(sourceId, targetId, [{ sourceMemberId: "skip-me", resolution: "skip" }]);
    expect(insertMock).not.toHaveBeenCalled();
  });
});

// ── getOwnedTreesForMerge ────────────────────────────────────────────────────

describe("getOwnedTreesForMerge", () => {
  it("returns owned trees excluding the target tree", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "tree_memberships")
        return {
          select: vi
            .fn()
            .mockReturnValue({
              eq: vi
                .fn()
                .mockReturnValue({
                  eq: vi
                    .fn()
                    .mockReturnValue({
                      neq: vi
                        .fn()
                        .mockResolvedValue({ data: [{ tree_id: sourceId }], error: null }),
                    }),
                }),
            }),
        };
      if (table === "family_trees")
        return {
          select: vi
            .fn()
            .mockReturnValue({
              in: vi
                .fn()
                .mockResolvedValue({
                  data: [
                    {
                      id: sourceId,
                      name: "Source Tree",
                      description: null,
                      is_public: false,
                      updated_at: "2026-01-01",
                    },
                  ],
                  error: null,
                }),
            }),
        };
      if (table === "tree_members")
        return {
          select: vi
            .fn()
            .mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        };
      return {};
    });

    const result = await getOwnedTreesForMerge(targetId);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(sourceId);
    expect(result.every((t) => t.id !== targetId)).toBe(true);
  });

  it("returns empty array when user owns no other trees", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "tree_memberships")
        return {
          select: vi
            .fn()
            .mockReturnValue({
              eq: vi
                .fn()
                .mockReturnValue({
                  eq: vi
                    .fn()
                    .mockReturnValue({ neq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
                }),
            }),
        };
      return {};
    });

    expect(await getOwnedTreesForMerge(targetId)).toEqual([]);
  });
});
