import { describe, it, expect } from "vitest";
import { formatDate, formatDateShort, formatRelativeTime, formatLifespan } from "./date";

describe("formatDate", () => {
  it("returns empty string for null input", () => {
    expect(formatDate(null)).toBe("");
  });

  it("formats ISO date string to readable format", () => {
    expect(formatDate("2000-06-15")).toBe("Jun 15, 2000");
  });

  it("formats full ISO datetime to date only", () => {
    expect(formatDate("1985-12-25T10:30:00Z")).toBe("Dec 25, 1985");
  });

  it("formats January date correctly", () => {
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
  });
});

describe("formatDateShort", () => {
  it("returns empty string for null input", () => {
    expect(formatDateShort(null)).toBe("");
  });

  it("returns year only", () => {
    expect(formatDateShort("2000-06-15")).toBe("2000");
  });

  it("handles full datetime string", () => {
    expect(formatDateShort("1950-03-20T00:00:00Z")).toBe("1950");
  });
});

describe("formatRelativeTime", () => {
  it("returns a string containing 'ago' for past dates", () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    const result = formatRelativeTime(pastDate);
    expect(result).toContain("ago");
  });

  it("returns a string containing 'in' for future dates", () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
    const result = formatRelativeTime(futureDate);
    expect(result).toContain("in");
  });
});

describe("formatLifespan", () => {
  it("returns empty string when no birth and not deceased", () => {
    expect(formatLifespan(null, null, false)).toBe("");
  });

  it("returns birth year with 'b.' prefix when alive", () => {
    expect(formatLifespan("1990-05-10", null, false)).toBe("b. 1990");
  });

  it("returns birth-death range when deceased with both dates", () => {
    expect(formatLifespan("1920-01-01", "2000-12-31", false)).toBe("1920 - 2000");
  });

  it("returns birth-? range when deceased with only birth date", () => {
    expect(formatLifespan("1920-01-01", null, true)).toBe("1920 - ?");
  });

  it("returns ?-death range when deceased with only death date", () => {
    expect(formatLifespan(null, "2000-12-31", false)).toBe("? - 2000");
  });

  it("returns ?-? range when deceased with no dates", () => {
    expect(formatLifespan(null, null, true)).toBe("? - ?");
  });

  it("shows death range when is_deceased is false but death date exists", () => {
    expect(formatLifespan("1950-01-01", "2020-06-15", false)).toBe("1950 - 2020");
  });
});
