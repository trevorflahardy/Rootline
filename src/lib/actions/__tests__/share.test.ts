import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/validate", () => ({ assertUUID: vi.fn() }));

const validUuid = "550e8400-e29b-41d4-a716-446655440000";

const mockClient = {
  from: vi.fn(),
};
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockClient,
}));

import { getPublicTree, getPublicMembers, getPublicRelationships } from "../share";

describe("getPublicTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for private tree", async () => {
    mockClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }));

    const result = await getPublicTree(validUuid);
    expect(result).toBeNull();
  });

  it("returns tree data for public tree", async () => {
    const mockTree = { id: validUuid, name: "Smith Family", is_public: true };

    mockClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockTree, error: null }),
          }),
        }),
      }),
    }));

    const result = await getPublicTree(validUuid);
    expect(result).toEqual(mockTree);
  });
});

describe("getPublicMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns members for public tree", async () => {
    const mockMembers = [
      { id: "member-1", tree_id: validUuid, first_name: "Alice", last_name: "Smith" },
      { id: "member-2", tree_id: validUuid, first_name: "Bob", last_name: "Smith" },
    ];

    mockClient.from.mockImplementation((table: string) => {
      if (table === "family_trees") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: validUuid }, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockMembers, error: null }),
        }),
      };
    });

    const result = await getPublicMembers(validUuid);
    expect(result).toEqual(mockMembers);
  });

  it("returns empty array when no members", async () => {
    mockClient.from.mockImplementation((table: string) => {
      if (table === "family_trees") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: validUuid }, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const result = await getPublicMembers(validUuid);
    expect(result).toEqual([]);
  });
});

describe("getPublicRelationships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns relationships", async () => {
    const mockRelationships = [
      {
        id: "rel-1",
        tree_id: validUuid,
        from_member_id: "member-1",
        to_member_id: "member-2",
        relationship_type: "parent_child",
      },
    ];

    mockClient.from.mockImplementation((table: string) => {
      if (table === "family_trees") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: validUuid }, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockRelationships, error: null }),
        }),
      };
    });

    const result = await getPublicRelationships(validUuid);
    expect(result).toEqual(mockRelationships);
  });
});
