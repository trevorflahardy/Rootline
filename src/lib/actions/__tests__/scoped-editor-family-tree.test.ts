/**
 * Phase 6: Scoped Editor Permission Boundary Tests
 *
 * The Hartwell Family Fixture:
 *
 *   Harold (GP) ─── grandparent
 *   ├── Alice (PA)  ← Eve's linked_node_id (scope root)
 *   │   ├── David  (CA)
 *   │   │   └── Fiona  (GCA)
 *   │   └── Eve    (CB) ← the scoped editor herself
 *   └── Bob   (PB)
 *       └── Carol  (CC)  ← "cousin" — out of scope
 *           └── George (GCC)
 *
 * Eve is an editor with linked_node_id = ALICE_ID.
 * She may only touch: Alice, David, Fiona, Eve.
 * She must NOT touch: Harold, Bob, Carol, George.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "eve-user-id" }),
  currentUser: vi.fn().mockResolvedValue({
    fullName: "Eve Hartwell",
    firstName: "Eve",
    emailAddresses: [{ emailAddress: "eve@hartwell.com" }],
    imageUrl: null,
  }),
}));
vi.mock("@/lib/actions/profile", () => ({
  ensureProfile: vi.fn(),
}));

// ─── Fixture IDs ───────────────────────────────────────────────────────────
const TREE_ID   = "aaaaaaaa-0000-4000-a000-000000000001";
const HAROLD_ID = "bbbbbbbb-0000-4000-a000-000000000001"; // grandparent
const ALICE_ID  = "cccccccc-0000-4000-a000-000000000001"; // scope root (Eve's linked_node_id)
const DAVID_ID  = "dddddddd-0000-4000-a000-000000000001"; // in-scope (Alice's child)
const FIONA_ID  = "eeeeeeee-0000-4000-a000-000000000001"; // in-scope (David's child)
const EVE_ID    = "ffffffff-0000-4000-a000-000000000001"; // in-scope (Alice's child — the editor)
const BOB_ID    = "11111111-0000-4000-a000-000000000001"; // out-of-scope (Harold's child)
const CAROL_ID  = "22222222-0000-4000-a000-000000000001"; // out-of-scope (Bob's child — "cousin")
const GEORGE_ID = "33333333-0000-4000-a000-000000000001"; // out-of-scope (Carol's child)

// ─── Mock Client ───────────────────────────────────────────────────────────
const mockRpc = vi.fn();
const mockClient = { from: vi.fn(), rpc: mockRpc };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockClient,
}));

import { updateMember, deleteMember, saveMemberPositions } from "../member";
import { createRelationship } from "../relationship";

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Ids considered descendants of ALICE_ID */
const ALICE_DESCENDANTS = new Set([ALICE_ID, DAVID_ID, FIONA_ID, EVE_ID]);

/**
 * Set up mockClient as Eve (scoped editor, linked_node_id = ALICE_ID).
 * The `isDescendantOf` mock resolves based on the fixture topology.
 * Override specific tables via the overrides map.
 */
function setupEveAsScopedEditor(
  overrides: Record<string, () => object> = {}
) {
  mockClient.from.mockImplementation((table: string) => {
    if (overrides[table]) return overrides[table]();

    if (table === "tree_memberships") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: "editor", linked_node_id: ALICE_ID },
                error: null,
              }),
            }),
          }),
        }),
      };
    }

    // Default: succeed for any DML
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
              single: vi.fn().mockResolvedValue({ data: { id: "upd-id" }, error: null }),
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

  // is_descendant_of: returns true when p_node_id is in Alice's subtree
  mockRpc.mockImplementation(
    (fn: string, args?: Record<string, string>) => {
      if (fn === "is_descendant_of") {
        const inScope = ALICE_DESCENDANTS.has(args?.p_node_id ?? "");
        return Promise.resolve({ data: inScope, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Scoped Editor — Member Attribute Edits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEveAsScopedEditor();
  });

  it("Eve can update a member in her branch (David)", async () => {
    const result = await updateMember(DAVID_ID, TREE_ID, { first_name: "Dave" });
    expect(result).toBeDefined();
  });

  it("Eve can update Alice (her scope root)", async () => {
    const result = await updateMember(ALICE_ID, TREE_ID, { first_name: "Alicia" });
    expect(result).toBeDefined();
  });

  it("Eve cannot update Carol (cousin — out of scope)", async () => {
    await expect(
      updateMember(CAROL_ID, TREE_ID, { first_name: "Caroline" })
    ).rejects.toThrow("You can only edit members in your branch");
  });

  it("Eve cannot update Harold (grandparent — out of scope)", async () => {
    await expect(
      updateMember(HAROLD_ID, TREE_ID, { first_name: "Harry" })
    ).rejects.toThrow("You can only edit members in your branch");
  });

  it("Eve cannot update George (great-cousin — out of scope)", async () => {
    await expect(
      updateMember(GEORGE_ID, TREE_ID, { last_name: "Hartwell" })
    ).rejects.toThrow("You can only edit members in your branch");
  });

  it("Eve cannot update Bob (uncle — out of scope)", async () => {
    await expect(
      updateMember(BOB_ID, TREE_ID, { first_name: "Robert" })
    ).rejects.toThrow("You can only edit members in your branch");
  });
});

describe("Scoped Editor — Member Deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEveAsScopedEditor();
  });

  it("Eve can delete David (in her branch)", async () => {
    await expect(deleteMember(DAVID_ID, TREE_ID)).resolves.toBeUndefined();
  });

  it("Eve cannot delete Carol (cousin — out of scope)", async () => {
    await expect(deleteMember(CAROL_ID, TREE_ID)).rejects.toThrow(
      "You can only delete members in your branch"
    );
  });

  it("Eve cannot delete Harold (grandparent — out of scope)", async () => {
    await expect(deleteMember(HAROLD_ID, TREE_ID)).rejects.toThrow(
      "You can only delete members in your branch"
    );
  });
});

describe("Scoped Editor — Cross-Branch Relationship Creation (BUG-001)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEveAsScopedEditor();
  });

  it("Eve can create relationship between two in-scope members (David→Fiona)", async () => {
    const result = await createRelationship({
      tree_id: TREE_ID,
      from_member_id: DAVID_ID,
      to_member_id: FIONA_ID,
      relationship_type: "parent_child",
    });
    expect(result).toBeDefined();
  });

  it("Eve cannot create relationship between in-scope and out-of-scope member (David→Carol) [BUG-001]", async () => {
    // David is in-scope (fromResult.data = true), Carol is out-of-scope (toResult.data = false)
    // BUG: current code uses && so this incorrectly succeeds
    await expect(
      createRelationship({
        tree_id: TREE_ID,
        from_member_id: DAVID_ID,
        to_member_id: CAROL_ID,
        relationship_type: "parent_child",
      })
    ).rejects.toThrow("You can only create relationships within your branch");
  });

  it("Eve cannot create relationship between out-of-scope and in-scope member (Carol→Fiona) [BUG-001]", async () => {
    // Carol is out-of-scope (fromResult.data = false), Fiona is in-scope (toResult.data = true)
    // BUG: current code uses && so this incorrectly succeeds
    await expect(
      createRelationship({
        tree_id: TREE_ID,
        from_member_id: CAROL_ID,
        to_member_id: FIONA_ID,
        relationship_type: "sibling",
      })
    ).rejects.toThrow("You can only create relationships within your branch");
  });

  it("Eve cannot create relationship between two out-of-scope members (Carol→George)", async () => {
    await expect(
      createRelationship({
        tree_id: TREE_ID,
        from_member_id: CAROL_ID,
        to_member_id: GEORGE_ID,
        relationship_type: "parent_child",
      })
    ).rejects.toThrow("You can only create relationships within your branch");
  });

  it("Eve cannot create spouse relationship linking her branch to the other branch (Fiona→George) [BUG-001]", async () => {
    await expect(
      createRelationship({
        tree_id: TREE_ID,
        from_member_id: FIONA_ID,
        to_member_id: GEORGE_ID,
        relationship_type: "spouse",
      })
    ).rejects.toThrow("You can only create relationships within your branch");
  });
});

describe("Scoped Editor — Position Save Scope (BUG-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Eve can save position for an in-scope member (David)", async () => {
    setupEveAsScopedEditor({
      tree_members: () => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }),
    });

    // Should not throw
    await expect(
      saveMemberPositions(TREE_ID, [{ id: DAVID_ID, position_x: 100, position_y: 200 }])
    ).resolves.toBeUndefined();
  });

  it("Eve cannot save position for an out-of-scope member (Carol) [BUG-002]", async () => {
    setupEveAsScopedEditor({
      tree_members: () => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }),
    });

    // BUG: current code has no scope check — this silently succeeds when it should be blocked
    await expect(
      saveMemberPositions(TREE_ID, [{ id: CAROL_ID, position_x: 300, position_y: 400 }])
    ).rejects.toThrow("You can only reposition members in your branch");
  });

  it("Eve cannot save positions for a mix of in-scope and out-of-scope members [BUG-002]", async () => {
    setupEveAsScopedEditor({
      tree_members: () => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }),
    });

    await expect(
      saveMemberPositions(TREE_ID, [
        { id: DAVID_ID, position_x: 100, position_y: 200 },
        { id: CAROL_ID, position_x: 300, position_y: 400 },
      ])
    ).rejects.toThrow("You can only reposition members in your branch");
  });
});

describe("Scoped Editor — Role Boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("viewer cannot update any member", async () => {
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
    mockRpc.mockResolvedValue({ data: null, error: null });

    await expect(
      updateMember(CAROL_ID, TREE_ID, { first_name: "Changed" })
    ).rejects.toThrow("Viewers cannot edit members");
  });

  it("unscoped editor (no linked_node_id) can edit any member", async () => {
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
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: CAROL_ID }, error: null }),
              }),
            }),
          }),
        }),
      };
    });
    mockRpc.mockResolvedValue({ data: null, error: null });

    const result = await updateMember(CAROL_ID, TREE_ID, { first_name: "Changed" });
    expect(result).toBeDefined();
  });
});

describe("Data Integrity Invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Owner for these tests — no scope blocking
    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: "owner", linked_node_id: null },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: "rel-id" }, error: null }),
          }),
        }),
      };
    });
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  it("cannot create a relationship where from_member_id === to_member_id (self-reference)", async () => {
    await expect(
      createRelationship({
        tree_id: TREE_ID,
        from_member_id: DAVID_ID,
        to_member_id: DAVID_ID,
        relationship_type: "parent_child",
      })
    ).rejects.toThrow();
  });
});
