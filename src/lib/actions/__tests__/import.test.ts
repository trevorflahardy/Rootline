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
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/rate-limit-config", () => ({
  RATE_LIMITS: new Proxy({}, { get: () => [100, 60_000] }),
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

import { importGedcomData } from "../import";
import type { ParsedMember, ParsedRelationship } from "@/lib/utils/gedcom-parser";

describe("importGedcomData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("imports members and relationships successfully", async () => {
    const members: ParsedMember[] = [
      {
        gedcom_id: "@I1@",
        first_name: "John",
        last_name: "Doe",
        maiden_name: null,
        gender: "male",
        date_of_birth: "1980-01-01",
        date_of_death: null,
        birth_place: "New York",
        death_place: null,
        bio: null,
        is_deceased: false,
      },
      {
        gedcom_id: "@I2@",
        first_name: "Jane",
        last_name: "Doe",
        maiden_name: "Smith",
        gender: "female",
        date_of_birth: "1982-03-15",
        date_of_death: null,
        birth_place: null,
        death_place: null,
        bio: null,
        is_deceased: false,
      },
    ];

    const relationships: ParsedRelationship[] = [
      {
        from_gedcom_id: "@I1@",
        to_gedcom_id: "@I2@",
        relationship_type: "spouse",
      },
    ];

    // Membership check
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
      if (table === "tree_members") {
        // Return different IDs for each insert call
        let insertCount = 0;
        return {
          insert: vi.fn().mockImplementation(() => ({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                insertCount++;
                return Promise.resolve({
                  data: {
                    id: `member-${insertCount}`,
                    tree_id: validUuid,
                    first_name: insertCount === 1 ? "John" : "Jane",
                    last_name: insertCount === 1 ? "Doe" : "Doe",
                  },
                  error: null,
                });
              }),
            }),
          })),
        };
      }
      if (table === "relationships") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "rel-1",
                  tree_id: validUuid,
                  from_member_id: "member-1",
                  to_member_id: "member-2",
                  relationship_type: "spouse",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await importGedcomData(validUuid, members, relationships);

    expect(result.members).toHaveLength(2);
    expect(result.relationships).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects when user is a viewer", async () => {
    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
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
        };
      }
      return {};
    });

    await expect(importGedcomData(validUuid, [], [])).rejects.toThrow("Viewers cannot import data");
  });

  it("rejects when user has no membership", async () => {
    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(importGedcomData(validUuid, [], [])).rejects.toThrow("No access to this tree");
  });

  it("collects errors for failed member inserts without throwing", async () => {
    const members: ParsedMember[] = [
      {
        gedcom_id: "@I1@",
        first_name: "BadMember",
        last_name: null,
        maiden_name: null,
        gender: null,
        date_of_birth: null,
        date_of_death: null,
        birth_place: null,
        death_place: null,
        bio: null,
        is_deceased: false,
      },
    ];

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
      if (table === "tree_members") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "DB constraint violation" },
              }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await importGedcomData(validUuid, members, []);

    expect(result.members).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("BadMember");
  });

  it("skips relationships when member IDs cannot be resolved", async () => {
    const relationships: ParsedRelationship[] = [
      {
        from_gedcom_id: "@MISSING1@",
        to_gedcom_id: "@MISSING2@",
        relationship_type: "parent_child",
      },
    ];

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
      return {};
    });

    const result = await importGedcomData(validUuid, [], relationships);

    expect(result.relationships).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("could not resolve member IDs");
  });

  it("throws on invalid treeId", async () => {
    await expect(importGedcomData("not-a-uuid", [], [])).rejects.toThrow("Invalid treeId");
  });
});
