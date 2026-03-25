import { describe, it, expect } from "vitest";
import { createTreeSchema } from "./tree";
import { createMemberSchema } from "./member";
import { createRelationshipSchema } from "./relationship";
import { createInviteSchema } from "./invite";

describe("createTreeSchema", () => {
  it("validates valid tree input", () => {
    const result = createTreeSchema.safeParse({ name: "My Family" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createTreeSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 100 chars", () => {
    const result = createTreeSchema.safeParse({ name: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepts optional description", () => {
    const result = createTreeSchema.safeParse({ name: "Tree", description: "A family tree" });
    expect(result.success).toBe(true);
  });
});

describe("createMemberSchema", () => {
  it("validates valid member input", () => {
    const result = createMemberSchema.safeParse({
      tree_id: "550e8400-e29b-41d4-a716-446655440000",
      first_name: "John",
      last_name: "Doe",
      gender: "male",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing first_name", () => {
    const result = createMemberSchema.safeParse({
      tree_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid gender", () => {
    const result = createMemberSchema.safeParse({
      tree_id: "550e8400-e29b-41d4-a716-446655440000",
      first_name: "Jane",
      gender: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid tree_id format", () => {
    const result = createMemberSchema.safeParse({
      tree_id: "not-a-uuid",
      first_name: "Jane",
    });
    expect(result.success).toBe(false);
  });
});

describe("createRelationshipSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";
  const otherUuid = "660e8400-e29b-41d4-a716-446655440001";

  it("validates valid relationship", () => {
    const result = createRelationshipSchema.safeParse({
      tree_id: validUuid,
      from_member_id: validUuid,
      to_member_id: otherUuid,
      relationship_type: "parent_child",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid relationship type", () => {
    const result = createRelationshipSchema.safeParse({
      tree_id: validUuid,
      from_member_id: validUuid,
      to_member_id: validUuid,
      relationship_type: "friend",
    });
    expect(result.success).toBe(false);
  });
});

describe("createInviteSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("validates valid invite", () => {
    const result = createInviteSchema.safeParse({
      tree_id: validUuid,
      role: "editor",
    });
    expect(result.success).toBe(true);
  });

  it("defaults role to editor", () => {
    const result = createInviteSchema.safeParse({ tree_id: validUuid });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("editor");
    }
  });

  it("rejects invalid email", () => {
    const result = createInviteSchema.safeParse({
      tree_id: validUuid,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});
