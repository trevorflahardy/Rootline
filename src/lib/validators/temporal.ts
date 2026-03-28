export class TemporalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemporalValidationError";
  }
}

/**
 * Throws if date_of_death is before date_of_birth.
 * Same-day death is allowed. If either date is null/undefined, the check is skipped.
 */
export function validateLifespan(
  dateOfBirth: string | null | undefined,
  dateOfDeath: string | null | undefined
): void {
  if (!dateOfBirth || !dateOfDeath) return;

  const birth = new Date(dateOfBirth);
  const death = new Date(dateOfDeath);

  if (death.getTime() < birth.getTime()) {
    throw new TemporalValidationError(
      "Date of death cannot be before date of birth"
    );
  }
}

/**
 * Throws if parent was born on or after the child's date of birth.
 * Parent must be born strictly before the child.
 * If either date is null/undefined, the check is skipped.
 */
export function validateParentChildDates(
  parent: { date_of_birth: string | null | undefined },
  child: { date_of_birth: string | null | undefined }
): void {
  if (!parent.date_of_birth || !child.date_of_birth) return;

  const parentBirth = new Date(parent.date_of_birth);
  const childBirth = new Date(child.date_of_birth);

  if (parentBirth.getTime() >= childBirth.getTime()) {
    throw new TemporalValidationError(
      "Parent must be born before the child"
    );
  }
}

/**
 * Throws if marriage start_date is before either partner's date of birth.
 * If start_date or either partner's DOB is null/undefined, the relevant check is skipped.
 */
export function validateMarriageDates(
  startDate: string | null | undefined,
  partnerA: { date_of_birth: string | null | undefined },
  partnerB: { date_of_birth: string | null | undefined }
): void {
  if (!startDate) return;

  const marriage = new Date(startDate);

  if (partnerA.date_of_birth) {
    const birthA = new Date(partnerA.date_of_birth);
    if (marriage.getTime() < birthA.getTime()) {
      throw new TemporalValidationError(
        "Marriage date cannot be before a partner's date of birth"
      );
    }
  }

  if (partnerB.date_of_birth) {
    const birthB = new Date(partnerB.date_of_birth);
    if (marriage.getTime() < birthB.getTime()) {
      throw new TemporalValidationError(
        "Marriage date cannot be before a partner's date of birth"
      );
    }
  }
}
