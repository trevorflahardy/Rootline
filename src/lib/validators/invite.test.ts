import { describe, expect, it } from "vitest";
import { createInviteSchema, acceptInviteSchema } from "./invite";

describe("createInviteSchema", () => {
  it("validates a minimal invite", () => {
    const result = createInviteSchema.safeParse({
      tree_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("editor");
      expect(result.data.max_uses).toBe(1);
    }
  });

  it("validates a full invite", () => {
    const result = createInviteSchema.safeParse({
      tree_id: "550e8400-e29b-41d4-a716-446655440000",
      email: "test@example.com",
      target_node_id: "660e8400-e29b-41d4-a716-446655440000",
      role: "viewer",
      max_uses: 5,
      expires_at: "2026-12-31T00:00:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("viewer");
      expect(result.data.max_uses).toBe(5);
    }
  });

  it("rejects invalid tree_id", () => {
    const result = createInviteSchema.safeParse({
      tree_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = createInviteSchema.safeParse({
      tree_id: "550e8400-e29b-41d4-a716-446655440000",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = createInviteSchema.safeParse({
      tree_id: "550e8400-e29b-41d4-a716-446655440000",
      role: "owner",
    });
    expect(result.success).toBe(false);
  });

  it("rejects max_uses below 1", () => {
    const result = createInviteSchema.safeParse({
      tree_id: "550e8400-e29b-41d4-a716-446655440000",
      max_uses: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects max_uses above 100", () => {
    const result = createInviteSchema.safeParse({
      tree_id: "550e8400-e29b-41d4-a716-446655440000",
      max_uses: 101,
    });
    expect(result.success).toBe(false);
  });
});

describe("acceptInviteSchema", () => {
  it("validates a valid invite code", () => {
    const result = acceptInviteSchema.safeParse({ invite_code: "abc123def456" });
    expect(result.success).toBe(true);
  });

  it("rejects empty invite code", () => {
    const result = acceptInviteSchema.safeParse({ invite_code: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing invite code", () => {
    const result = acceptInviteSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
