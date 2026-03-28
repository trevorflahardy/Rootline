import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "user-1" }),
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
const validMemberId1 = "660e8400-e29b-41d4-a716-446655440000";
const validMemberId2 = "770e8400-e29b-41d4-a716-446655440000";
const validMemberId3 = "880e8400-e29b-41d4-a716-446655440000";

function createChainableQuery(resolvedValue: { data: unknown; error: unknown }) {
  // Lazily creates chain objects to avoid infinite recursion
  const make = (): Record<string, unknown> => {
    const obj: Record<string, unknown> = {
      data: resolvedValue.data,
      error: resolvedValue.error,
      single: vi.fn().mockResolvedValue(resolvedValue),
      maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
      then: undefined, // prevent await from treating as thenable
    };
    const chainMethods = [
      "select", "insert", "update", "delete",
      "eq", "neq", "or", "and", "limit", "order",
    ];
    for (const method of chainMethods) {
      obj[method] = vi.fn().mockImplementation(() => make());
    }
    return obj;
  };

  return make();
}

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

import { createMember } from "@/lib/actions/member";
import { createRelationship } from "@/lib/actions/relationship";
import { TemporalValidationError } from "@/lib/validators/temporal";
import { CycleDetectionError } from "@/lib/validators/cycle-detection";
import { GraphValidationError } from "@/lib/validators/graph";

describe("Validator integration with server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createMember — lifespan validation", () => {
    it("rejects member with date_of_death before date_of_birth", async () => {
      // The validation fires before any Supabase call, so no mock setup needed
      // beyond what schema validation requires (valid tree_id uuid)
      await expect(
        createMember({
          tree_id: validTreeId,
          first_name: "John",
          date_of_birth: "2000-01-01",
          date_of_death: "1990-01-01",
        })
      ).rejects.toThrow(TemporalValidationError);
    });

    it("accepts member with valid dates and creates successfully", async () => {
      const mockMember = {
        id: "new-member-1",
        tree_id: validTreeId,
        first_name: "Jane",
        date_of_birth: "1980-01-01",
        date_of_death: "2050-01-01",
        created_at: "2026-01-01T00:00:00Z",
      };

      mockClient.from.mockImplementation((table: string) => {
        if (table === "tree_memberships") {
          return createChainableQuery({
            data: { role: "owner", linked_node_id: null },
            error: null,
          });
        }
        if (table === "tree_members") {
          return createChainableQuery({ data: mockMember, error: null });
        }
        return createChainableQuery({ data: null, error: null });
      });
      mockClient.rpc.mockResolvedValue({ data: null, error: null });

      const result = await createMember({
        tree_id: validTreeId,
        first_name: "Jane",
        date_of_birth: "1980-01-01",
        date_of_death: "2050-01-01",
      });
      expect(result.first_name).toBe("Jane");
    });
  });

  describe("createRelationship — cycle detection", () => {
    it("rejects parent_child that would create a cycle", async () => {
      // Existing relationships: member1 -> member2 -> member3 (parent_child chain)
      // Trying to add: member3 -> member1 (would create cycle)
      const existingRelationships = [
        {
          id: "rel-1",
          from_member_id: validMemberId1,
          to_member_id: validMemberId2,
          relationship_type: "parent_child",
        },
        {
          id: "rel-2",
          from_member_id: validMemberId2,
          to_member_id: validMemberId3,
          relationship_type: "parent_child",
        },
      ];

      mockClient.from.mockImplementation((table: string) => {
        if (table === "tree_memberships") {
          return createChainableQuery({
            data: { role: "owner", linked_node_id: null },
            error: null,
          });
        }
        if (table === "relationships") {
          // The fetch for existing relationships (used by detectDuplicateRelationship and detectCycle)
          return createChainableQuery({
            data: existingRelationships,
            error: null,
          });
        }
        if (table === "tree_members") {
          return createChainableQuery({
            data: { date_of_birth: null },
            error: null,
          });
        }
        return createChainableQuery({ data: null, error: null });
      });

      await expect(
        createRelationship({
          tree_id: validTreeId,
          from_member_id: validMemberId3,
          to_member_id: validMemberId1,
          relationship_type: "parent_child",
        })
      ).rejects.toThrow(CycleDetectionError);
    });
  });

  describe("createRelationship — duplicate detection", () => {
    it("rejects duplicate relationship via graph validator", async () => {
      const existingRelationships = [
        {
          id: "rel-1",
          from_member_id: validMemberId1,
          to_member_id: validMemberId2,
          relationship_type: "spouse",
        },
      ];

      mockClient.from.mockImplementation((table: string) => {
        if (table === "tree_memberships") {
          return createChainableQuery({
            data: { role: "owner", linked_node_id: null },
            error: null,
          });
        }
        if (table === "relationships") {
          return createChainableQuery({
            data: existingRelationships,
            error: null,
          });
        }
        return createChainableQuery({ data: null, error: null });
      });

      await expect(
        createRelationship({
          tree_id: validTreeId,
          from_member_id: validMemberId1,
          to_member_id: validMemberId2,
          relationship_type: "spouse",
        })
      ).rejects.toThrow(GraphValidationError);
    });
  });

  describe("createRelationship — valid input succeeds", () => {
    it("creates parent_child relationship when all validations pass", async () => {
      const mockRel = {
        id: "new-rel-1",
        tree_id: validTreeId,
        from_member_id: validMemberId1,
        to_member_id: validMemberId2,
        relationship_type: "parent_child",
        start_date: null,
        end_date: null,
        created_at: "2026-01-01T00:00:00Z",
      };

      let relCallCount = 0;
      mockClient.from.mockImplementation((table: string) => {
        if (table === "tree_memberships") {
          return createChainableQuery({
            data: { role: "owner", linked_node_id: null },
            error: null,
          });
        }
        if (table === "relationships") {
          relCallCount++;
          if (relCallCount === 1) {
            // First call: validation fetch — return empty array (no existing rels)
            return createChainableQuery({ data: [], error: null });
          }
          // Second call: insert — return the new relationship
          return createChainableQuery({ data: mockRel, error: null });
        }
        if (table === "tree_members") {
          return createChainableQuery({
            data: { date_of_birth: "1960-01-01" },
            error: null,
          });
        }
        return createChainableQuery({ data: null, error: null });
      });
      mockClient.rpc.mockResolvedValue({ data: null, error: null });

      const result = await createRelationship({
        tree_id: validTreeId,
        from_member_id: validMemberId1,
        to_member_id: validMemberId2,
        relationship_type: "parent_child",
      });
      expect(result.relationship_type).toBe("parent_child");
    });
  });
});
