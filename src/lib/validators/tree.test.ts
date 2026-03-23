import { describe, it, expect } from "vitest";
import { createTreeSchema, updateTreeSchema } from "./tree";

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

  it("accepts name at exactly 100 chars", () => {
    const result = createTreeSchema.safeParse({ name: "a".repeat(100) });
    expect(result.success).toBe(true);
  });

  it("accepts optional description", () => {
    const result = createTreeSchema.safeParse({ name: "Tree", description: "A family tree" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("A family tree");
    }
  });

  it("rejects description over 500 chars", () => {
    const result = createTreeSchema.safeParse({ name: "Tree", description: "x".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("accepts missing description", () => {
    const result = createTreeSchema.safeParse({ name: "Tree" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeUndefined();
    }
  });
});

describe("updateTreeSchema", () => {
  it("accepts partial update with name only", () => {
    const result = updateTreeSchema.safeParse({ name: "Updated Name" });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with description only", () => {
    const result = updateTreeSchema.safeParse({ description: "New description" });
    expect(result.success).toBe(true);
  });

  it("accepts is_public boolean", () => {
    const result = updateTreeSchema.safeParse({ is_public: true });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (all fields optional)", () => {
    const result = updateTreeSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects name under 1 char when provided", () => {
    const result = updateTreeSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 100 chars when provided", () => {
    const result = updateTreeSchema.safeParse({ name: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects description over 500 chars when provided", () => {
    const result = updateTreeSchema.safeParse({ description: "x".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean is_public", () => {
    const result = updateTreeSchema.safeParse({ is_public: "yes" });
    expect(result.success).toBe(false);
  });

  it("accepts all fields together", () => {
    const result = updateTreeSchema.safeParse({
      name: "Updated",
      description: "Updated desc",
      is_public: false,
    });
    expect(result.success).toBe(true);
  });
});
