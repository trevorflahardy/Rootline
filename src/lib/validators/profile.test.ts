import { describe, it, expect } from "vitest";
import { updateProfilePreferencesSchema } from "./profile";

describe("updateProfilePreferencesSchema", () => {
  it("validates valid depth value", () => {
    const result = updateProfilePreferencesSchema.safeParse({
      descendant_highlight_depth: 3,
    });
    expect(result.success).toBe(true);
  });

  it("accepts zero depth", () => {
    const result = updateProfilePreferencesSchema.safeParse({
      descendant_highlight_depth: 0,
    });
    expect(result.success).toBe(true);
  });

  it("accepts maximum depth of 10", () => {
    const result = updateProfilePreferencesSchema.safeParse({
      descendant_highlight_depth: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative depth", () => {
    const result = updateProfilePreferencesSchema.safeParse({
      descendant_highlight_depth: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects depth above 10", () => {
    const result = updateProfilePreferencesSchema.safeParse({
      descendant_highlight_depth: 11,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer depth", () => {
    const result = updateProfilePreferencesSchema.safeParse({
      descendant_highlight_depth: 2.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing depth field", () => {
    const result = updateProfilePreferencesSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects string values", () => {
    const result = updateProfilePreferencesSchema.safeParse({
      descendant_highlight_depth: "three",
    });
    expect(result.success).toBe(false);
  });
});
