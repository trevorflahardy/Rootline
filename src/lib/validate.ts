/**
 * Shared validation utilities for server actions.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Asserts that a value is a valid UUID v4.
 * Throws if the check fails, preventing DB queries with invalid IDs.
 *
 * @param value - The string to validate
 * @param name  - Field name used in the error message (default: "id")
 */
export function assertUUID(value: string, name = 'id'): void {
  if (!UUID_RE.test(value)) {
    throw new Error(`Invalid ${name}: must be a UUID`);
  }
}
