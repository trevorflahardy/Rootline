import { describe, it, expect } from "vitest";
import {
  TemporalValidationError,
  validateLifespan,
  validateParentChildDates,
  validateMarriageDates,
} from "../../src/lib/validators/temporal";

describe("validateLifespan", () => {
  it("should throw when death is before birth", () => {
    expect(() =>
      validateLifespan("2000-01-01", "1990-01-01")
    ).toThrow(TemporalValidationError);
  });

  it("should throw when updating death to before existing birth", () => {
    expect(() =>
      validateLifespan("1985-06-15", "1980-03-20")
    ).toThrow(TemporalValidationError);
    expect(() =>
      validateLifespan("1985-06-15", "1980-03-20")
    ).toThrow("Date of death cannot be before date of birth");
  });

  it("should allow death on the same day as birth", () => {
    expect(() =>
      validateLifespan("2000-06-15", "2000-06-15")
    ).not.toThrow();
  });

  it("should skip check when only death is set (no DOB)", () => {
    expect(() => validateLifespan(null, "2020-01-01")).not.toThrow();
  });

  it("should skip check when only birth is set (no DOD)", () => {
    expect(() => validateLifespan("1990-01-01", null)).not.toThrow();
  });

  it("should skip check when both are null", () => {
    expect(() => validateLifespan(null, null)).not.toThrow();
  });

  it("should allow normal lifespan", () => {
    expect(() =>
      validateLifespan("1950-01-01", "2020-12-31")
    ).not.toThrow();
  });

  it("should throw when validating reversed args (simulating DOB update that violates)", () => {
    // Simulates: member has death 1980, user tries to update birth to 1990
    expect(() =>
      validateLifespan("1990-01-01", "1980-01-01")
    ).toThrow(TemporalValidationError);
  });
});

describe("validateParentChildDates", () => {
  it("should throw when parent is born after child", () => {
    expect(() =>
      validateParentChildDates(
        { date_of_birth: "2000-01-01" },
        { date_of_birth: "1990-01-01" }
      )
    ).toThrow(TemporalValidationError);
  });

  it("should throw when parent is born same year as child (parent month after child)", () => {
    expect(() =>
      validateParentChildDates(
        { date_of_birth: "1990-06-15" },
        { date_of_birth: "1990-01-01" }
      )
    ).toThrow(TemporalValidationError);
    expect(() =>
      validateParentChildDates(
        { date_of_birth: "1990-06-15" },
        { date_of_birth: "1990-01-01" }
      )
    ).toThrow("Parent must be born before the child");
  });

  it("should throw when parent and child born on exact same date", () => {
    expect(() =>
      validateParentChildDates(
        { date_of_birth: "1990-01-01" },
        { date_of_birth: "1990-01-01" }
      )
    ).toThrow(TemporalValidationError);
  });

  it("should allow parent born 12+ years before child", () => {
    expect(() =>
      validateParentChildDates(
        { date_of_birth: "1970-01-01" },
        { date_of_birth: "1995-06-15" }
      )
    ).not.toThrow();
  });

  it("should skip check when parent has no DOB", () => {
    expect(() =>
      validateParentChildDates(
        { date_of_birth: null },
        { date_of_birth: "1990-01-01" }
      )
    ).not.toThrow();
  });

  it("should skip check when child has no DOB", () => {
    expect(() =>
      validateParentChildDates(
        { date_of_birth: "1970-01-01" },
        { date_of_birth: null }
      )
    ).not.toThrow();
  });
});

describe("validateMarriageDates", () => {
  it("should throw when marriage start is before partner A DOB", () => {
    expect(() =>
      validateMarriageDates(
        "1980-01-01",
        { date_of_birth: "1990-01-01" },
        { date_of_birth: "1988-01-01" }
      )
    ).toThrow(TemporalValidationError);
    expect(() =>
      validateMarriageDates(
        "1980-01-01",
        { date_of_birth: "1990-01-01" },
        { date_of_birth: "1988-01-01" }
      )
    ).toThrow("Marriage date cannot be before a partner's date of birth");
  });

  it("should throw when marriage start is before partner B DOB", () => {
    expect(() =>
      validateMarriageDates(
        "1985-01-01",
        { date_of_birth: "1980-01-01" },
        { date_of_birth: "1990-01-01" }
      )
    ).toThrow(TemporalValidationError);
  });

  it("should allow marriage after both partners DOBs", () => {
    expect(() =>
      validateMarriageDates(
        "2010-06-15",
        { date_of_birth: "1985-01-01" },
        { date_of_birth: "1987-03-20" }
      )
    ).not.toThrow();
  });

  it("should skip check when one partner has no DOB", () => {
    expect(() =>
      validateMarriageDates(
        "2010-06-15",
        { date_of_birth: null },
        { date_of_birth: "1987-03-20" }
      )
    ).not.toThrow();
  });

  it("should skip check when start date is null", () => {
    expect(() =>
      validateMarriageDates(
        null,
        { date_of_birth: "1985-01-01" },
        { date_of_birth: "1987-03-20" }
      )
    ).not.toThrow();
  });

  it("should allow marriage on partner DOB", () => {
    expect(() =>
      validateMarriageDates(
        "1990-01-01",
        { date_of_birth: "1990-01-01" },
        { date_of_birth: "1985-01-01" }
      )
    ).not.toThrow();
  });
});
