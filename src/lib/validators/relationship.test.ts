import { describe, it, expect } from "vitest";
import { createRelationshipSchema } from "./relationship";

const validUuid = "550e8400-e29b-41d4-a716-446655440000";
const validUuid2 = "660e8400-e29b-41d4-a716-446655440000";
const validUuid3 = "770e8400-e29b-41d4-a716-446655440000";

describe("createRelationshipSchema", () => {
  it("validates valid parent_child relationship", () => {
    const result = createRelationshipSchema.safeParse({
      tree_id: validUuid,
      from_member_id: validUuid2,
      to_member_id: validUuid3,
      relationship_type: "parent_child",
    });
    expect(result.success).toBe(true);
  });

  it("validates all relationship types", () => {
    for (const type of ["parent_child", "spouse", "divorced", "adopted"]) {
      const result = createRelationshipSchema.safeParse({
        tree_id: validUuid,
        from_member_id: validUuid2,
        to_member_id: validUuid3,
        relationship_type: type,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid relationship type", () => {
    const result = createRelationshipSchema.safeParse({
      tree_id: validUuid,
      from_member_id: validUuid2,
      to_member_id: validUuid3,
      relationship_type: "friend",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing tree_id", () => {
    const result = createRelationshipSchema.safeParse({
      from_member_id: validUuid2,
      to_member_id: validUuid3,
      relationship_type: "spouse",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing from_member_id", () => {
    const result = createRelationshipSchema.safeParse({
      tree_id: validUuid,
      to_member_id: validUuid3,
      relationship_type: "spouse",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing to_member_id", () => {
    const result = createRelationshipSchema.safeParse({
      tree_id: validUuid,
      from_member_id: validUuid2,
      relationship_type: "spouse",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID for tree_id", () => {
    const result = createRelationshipSchema.safeParse({
      tree_id: "not-uuid",
      from_member_id: validUuid2,
      to_member_id: validUuid3,
      relationship_type: "parent_child",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional start_date", () => {
    const result = createRelationshipSchema.safeParse({
      tree_id: validUuid,
      from_member_id: validUuid2,
      to_member_id: validUuid3,
      relationship_type: "spouse",
      start_date: "2020-06-15",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.start_date).toBe("2020-06-15");
    }
  });

  it("accepts optional end_date", () => {
    const result = createRelationshipSchema.safeParse({
      tree_id: validUuid,
      from_member_id: validUuid2,
      to_member_id: validUuid3,
      relationship_type: "divorced",
      start_date: "2015-01-01",
      end_date: "2020-12-31",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.end_date).toBe("2020-12-31");
    }
  });

  it("rejects missing relationship_type", () => {
    const result = createRelationshipSchema.safeParse({
      tree_id: validUuid,
      from_member_id: validUuid2,
      to_member_id: validUuid3,
    });
    expect(result.success).toBe(false);
  });
});
