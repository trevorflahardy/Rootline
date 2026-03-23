import { describe, it, expect } from "vitest";
import { createMemberSchema, updateMemberSchema } from "./member";

const validUuid = "550e8400-e29b-41d4-a716-446655440000";

describe("createMemberSchema", () => {
  it("validates minimal input with required fields", () => {
    const result = createMemberSchema.safeParse({
      tree_id: validUuid,
      first_name: "Jane",
    });
    expect(result.success).toBe(true);
  });

  it("validates full input with all fields", () => {
    const result = createMemberSchema.safeParse({
      tree_id: validUuid,
      first_name: "Jane",
      last_name: "Doe",
      maiden_name: "Smith",
      gender: "female",
      date_of_birth: "1990-01-15",
      date_of_death: "2050-12-31",
      birth_place: "New York",
      death_place: "Boston",
      bio: "A brief biography.",
      is_deceased: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing tree_id", () => {
    const result = createMemberSchema.safeParse({ first_name: "Jane" });
    expect(result.success).toBe(false);
  });

  it("rejects missing first_name", () => {
    const result = createMemberSchema.safeParse({ tree_id: validUuid });
    expect(result.success).toBe(false);
  });

  it("rejects empty first_name", () => {
    const result = createMemberSchema.safeParse({
      tree_id: validUuid,
      first_name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects first_name over 100 chars", () => {
    const result = createMemberSchema.safeParse({
      tree_id: validUuid,
      first_name: "a".repeat(101),
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

  it("accepts all valid gender values", () => {
    for (const gender of ["male", "female", "other", "unknown"]) {
      const result = createMemberSchema.safeParse({
        tree_id: validUuid,
        first_name: "Test",
        gender,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid gender", () => {
    const result = createMemberSchema.safeParse({
      tree_id: validUuid,
      first_name: "Jane",
      gender: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects bio over 2000 chars", () => {
    const result = createMemberSchema.safeParse({
      tree_id: validUuid,
      first_name: "Jane",
      bio: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects birth_place over 200 chars", () => {
    const result = createMemberSchema.safeParse({
      tree_id: validUuid,
      first_name: "Jane",
      birth_place: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe("updateMemberSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    const result = updateMemberSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial update with first_name only", () => {
    const result = updateMemberSchema.safeParse({ first_name: "Updated" });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with gender only", () => {
    const result = updateMemberSchema.safeParse({ gender: "male" });
    expect(result.success).toBe(true);
  });

  it("rejects empty first_name when provided", () => {
    const result = updateMemberSchema.safeParse({ first_name: "" });
    expect(result.success).toBe(false);
  });

  it("accepts is_deceased boolean", () => {
    const result = updateMemberSchema.safeParse({ is_deceased: true });
    expect(result.success).toBe(true);
  });

  it("rejects invalid gender when provided", () => {
    const result = updateMemberSchema.safeParse({ gender: "robot" });
    expect(result.success).toBe(false);
  });

  it("accepts all updatable fields together", () => {
    const result = updateMemberSchema.safeParse({
      first_name: "Updated",
      last_name: "Name",
      maiden_name: "Maiden",
      gender: "other",
      date_of_birth: "1990-01-01",
      date_of_death: "2080-01-01",
      birth_place: "City",
      death_place: "Town",
      bio: "Updated bio",
      is_deceased: false,
    });
    expect(result.success).toBe(true);
  });
});
