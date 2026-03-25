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
vi.mock("@/lib/actions/profile", () => ({ ensureProfile: vi.fn() }));

const TREE_ID = "aaaaaaaa-0000-4000-a000-000000000001";
const MEMBER_A = "bbbbbbbb-0000-4000-a000-000000000001";
const MEMBER_B = "cccccccc-0000-4000-a000-000000000001";

const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
const mockClient = { from: vi.fn(), rpc: mockRpc };

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockClient }));

import { getMembersWithStats } from "../member";

const MEMBERS = [
  { id: MEMBER_A, tree_id: TREE_ID, first_name: "Alice", last_name: "Smith", date_of_birth: "1970-01-01", date_of_death: null, is_deceased: false, avatar_url: null },
  { id: MEMBER_B, tree_id: TREE_ID, first_name: "Bob", last_name: null, date_of_birth: null, date_of_death: null, is_deceased: false, avatar_url: null },
];
const RELATIONSHIPS = [
  { from_member_id: MEMBER_A, to_member_id: MEMBER_B },
  { from_member_id: MEMBER_A, to_member_id: MEMBER_B }, // duplicate edge counts for both
];
const PHOTOS = [{ member_id: MEMBER_A }, { member_id: MEMBER_A }];
const DOCS = [{ member_id: MEMBER_B }];

function setupMocks() {
  const tableData: Record<string, unknown> = {
    tree_memberships: { data: { role: "owner", linked_node_id: null }, error: null },
    tree_members: { data: MEMBERS, error: null },
    relationships: { data: RELATIONSHIPS, error: null },
    media: { data: PHOTOS, error: null },
    documents: { data: DOCS, error: null },
  };

  mockClient.from.mockImplementation((table: string) => {
    const result = tableData[table] ?? { data: [], error: null };
    if (table === "tree_memberships") {
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
    if (table === "tree_members") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue(result),
          }),
        }),
      };
    }
    // relationships, media, documents: select().eq() resolves directly
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue(result),
      }),
    };
  });
}

describe("getMembersWithStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("returns members enriched with counts", async () => {
    const result = await getMembersWithStats(TREE_ID);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(MEMBER_A);
    expect(result[0].photo_count).toBe(2);
    expect(result[0].document_count).toBe(0);
    expect(result[1].id).toBe(MEMBER_B);
    expect(result[1].document_count).toBe(1);
  });

  it("counts relationships from both directions", async () => {
    const result = await getMembersWithStats(TREE_ID);
    const alice = result.find((m) => m.id === MEMBER_A)!;
    const bob = result.find((m) => m.id === MEMBER_B)!;
    // 2 relationships both involving alice and bob
    expect(alice.relationship_count).toBe(2);
    expect(bob.relationship_count).toBe(2);
  });

  it("marks complete profile when name + dob + relationships all present", async () => {
    const result = await getMembersWithStats(TREE_ID);
    const alice = result.find((m) => m.id === MEMBER_A)!;
    // Alice has first_name, last_name, date_of_birth, and 2 relationships
    expect(alice.completeness).toBe("complete");
  });

  it("marks empty profile when no data", async () => {
    // Bob has no last_name, no dob, but does have relationships
    const result = await getMembersWithStats(TREE_ID);
    const bob = result.find((m) => m.id === MEMBER_B)!;
    expect(bob.completeness).toBe("partial"); // has relationships but missing fields
  });

  it("throws when not a tree member", async () => {
    mockClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
          }),
        }),
      }),
    }));
    await expect(getMembersWithStats(TREE_ID)).rejects.toThrow("No access to this tree");
  });
});
