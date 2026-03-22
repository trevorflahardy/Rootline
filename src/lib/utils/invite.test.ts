import { describe, expect, it } from "vitest";

// Test invite validation logic (business rules, not server actions)

describe("invite business rules", () => {
  function isInviteExpired(expiresAt: string | null): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  }

  function isInviteMaxedOut(useCount: number, maxUses: number): boolean {
    return useCount >= maxUses;
  }

  function isInviteValid(invite: {
    expires_at: string | null;
    use_count: number;
    max_uses: number;
  }): boolean {
    return !isInviteExpired(invite.expires_at) && !isInviteMaxedOut(invite.use_count, invite.max_uses);
  }

  it("active invite with no expiry is valid", () => {
    expect(isInviteValid({ expires_at: null, use_count: 0, max_uses: 5 })).toBe(true);
  });

  it("active invite with future expiry is valid", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isInviteValid({ expires_at: future, use_count: 0, max_uses: 1 })).toBe(true);
  });

  it("expired invite is invalid", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isInviteValid({ expires_at: past, use_count: 0, max_uses: 1 })).toBe(false);
  });

  it("maxed out invite is invalid", () => {
    expect(isInviteValid({ expires_at: null, use_count: 5, max_uses: 5 })).toBe(false);
  });

  it("over-used invite is invalid", () => {
    expect(isInviteValid({ expires_at: null, use_count: 6, max_uses: 5 })).toBe(false);
  });

  it("partially used invite is valid", () => {
    expect(isInviteValid({ expires_at: null, use_count: 3, max_uses: 5 })).toBe(true);
  });

  it("expired AND maxed out invite is invalid", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isInviteValid({ expires_at: past, use_count: 5, max_uses: 5 })).toBe(false);
  });
});

describe("invite permission scoping", () => {
  type Role = "owner" | "editor" | "viewer";

  function canCreateInvite(role: Role): boolean {
    return role === "owner";
  }

  function canRevokeInvite(role: Role): boolean {
    return role === "owner";
  }

  function canEditMember(role: Role, hasDescendantAccess: boolean): boolean {
    if (role === "owner") return true;
    if (role === "editor") return hasDescendantAccess;
    return false;
  }

  it("owner can create invites", () => {
    expect(canCreateInvite("owner")).toBe(true);
  });

  it("editor cannot create invites", () => {
    expect(canCreateInvite("editor")).toBe(false);
  });

  it("viewer cannot create invites", () => {
    expect(canCreateInvite("viewer")).toBe(false);
  });

  it("owner can revoke invites", () => {
    expect(canRevokeInvite("owner")).toBe(true);
  });

  it("editor cannot revoke invites", () => {
    expect(canRevokeInvite("editor")).toBe(false);
  });

  it("owner can always edit members", () => {
    expect(canEditMember("owner", false)).toBe(true);
  });

  it("editor can edit descendants", () => {
    expect(canEditMember("editor", true)).toBe(true);
  });

  it("editor cannot edit non-descendants", () => {
    expect(canEditMember("editor", false)).toBe(false);
  });

  it("viewer cannot edit members", () => {
    expect(canEditMember("viewer", true)).toBe(false);
  });
});
