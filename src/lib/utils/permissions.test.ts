import { describe, expect, it } from "vitest";

// Test permission logic (business rules, not server actions)

type TreeRole = "owner" | "editor" | "viewer";

interface Membership {
  role: TreeRole;
  linked_node_id: string | null;
}

function getPermissions(membership: Membership | null) {
  if (!membership) {
    return { role: "viewer" as TreeRole, isOwner: false, canEdit: false, linkedNodeId: null };
  }
  return {
    role: membership.role,
    isOwner: membership.role === "owner",
    canEdit: membership.role === "owner" || membership.role === "editor",
    linkedNodeId: membership.linked_node_id,
  };
}

function canEditMember(
  membership: Membership | null,
  _memberId: string,
  isDescendant: boolean
): boolean {
  if (!membership) return false;
  if (membership.role === "owner") return true;
  if (membership.role === "viewer") return false;
  // Editor
  if (membership.linked_node_id) return isDescendant;
  return true; // Editor with no linked node
}

function canSelfAssign(membership: Membership | null): boolean {
  if (!membership) return false;
  if (membership.role === "owner") return false;
  return !membership.linked_node_id;
}

describe("getPermissions", () => {
  it("returns viewer defaults for no membership", () => {
    const perms = getPermissions(null);
    expect(perms.role).toBe("viewer");
    expect(perms.isOwner).toBe(false);
    expect(perms.canEdit).toBe(false);
  });

  it("owner has full permissions", () => {
    const perms = getPermissions({ role: "owner", linked_node_id: null });
    expect(perms.isOwner).toBe(true);
    expect(perms.canEdit).toBe(true);
  });

  it("editor can edit", () => {
    const perms = getPermissions({ role: "editor", linked_node_id: "node-1" });
    expect(perms.isOwner).toBe(false);
    expect(perms.canEdit).toBe(true);
    expect(perms.linkedNodeId).toBe("node-1");
  });

  it("viewer cannot edit", () => {
    const perms = getPermissions({ role: "viewer", linked_node_id: null });
    expect(perms.isOwner).toBe(false);
    expect(perms.canEdit).toBe(false);
  });
});

describe("canEditMember", () => {
  it("owner can edit any member", () => {
    expect(canEditMember({ role: "owner", linked_node_id: null }, "any", false)).toBe(true);
  });

  it("viewer cannot edit any member", () => {
    expect(canEditMember({ role: "viewer", linked_node_id: null }, "any", true)).toBe(false);
  });

  it("editor with no linked node can edit all", () => {
    expect(canEditMember({ role: "editor", linked_node_id: null }, "any", false)).toBe(true);
  });

  it("editor with linked node can edit descendants", () => {
    expect(canEditMember({ role: "editor", linked_node_id: "root" }, "child", true)).toBe(true);
  });

  it("editor with linked node cannot edit non-descendants", () => {
    expect(canEditMember({ role: "editor", linked_node_id: "root" }, "cousin", false)).toBe(false);
  });

  it("no membership means no edit", () => {
    expect(canEditMember(null, "any", true)).toBe(false);
  });
});

describe("canSelfAssign", () => {
  it("owner cannot self-assign", () => {
    expect(canSelfAssign({ role: "owner", linked_node_id: null })).toBe(false);
  });

  it("editor without linked node can self-assign", () => {
    expect(canSelfAssign({ role: "editor", linked_node_id: null })).toBe(true);
  });

  it("editor already linked cannot self-assign", () => {
    expect(canSelfAssign({ role: "editor", linked_node_id: "node-1" })).toBe(false);
  });

  it("viewer without linked node can self-assign", () => {
    expect(canSelfAssign({ role: "viewer", linked_node_id: null })).toBe(true);
  });

  it("no membership cannot self-assign", () => {
    expect(canSelfAssign(null)).toBe(false);
  });
});
