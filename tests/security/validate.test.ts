import { describe, it, expect } from 'vitest';
import { assertUUID } from '../../src/lib/validate';

// ---------------------------------------------------------------------------
// assertUUID — valid UUIDs
// ---------------------------------------------------------------------------
describe('assertUUID — valid UUIDs', () => {
  it('passes for a standard lowercase UUID v4', () => {
    expect(() =>
      assertUUID('550e8400-e29b-41d4-a716-446655440000')
    ).not.toThrow();
  });

  it('passes for a UUID with uppercase hex digits', () => {
    expect(() =>
      assertUUID('550E8400-E29B-41D4-A716-446655440000')
    ).not.toThrow();
  });

  it('passes for a mixed-case UUID', () => {
    expect(() =>
      assertUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')
    ).not.toThrow();
  });

  it('passes for a nil-like UUID (all zeros)', () => {
    expect(() =>
      assertUUID('00000000-0000-0000-0000-000000000000')
    ).not.toThrow();
  });

  it('passes for a UUID with all hex f digits', () => {
    expect(() =>
      assertUUID('ffffffff-ffff-ffff-ffff-ffffffffffff')
    ).not.toThrow();
  });

  it('uses the default field name "id" in the error message', () => {
    expect(() => assertUUID('bad')).toThrow(/Invalid id/);
  });

  it('uses a custom field name in the error message when provided', () => {
    expect(() => assertUUID('bad', 'treeId')).toThrow(/Invalid treeId/);
  });
});

// ---------------------------------------------------------------------------
// assertUUID — invalid inputs that must throw
// ---------------------------------------------------------------------------
describe('assertUUID — invalid inputs', () => {
  it('throws for the string "not-a-uuid"', () => {
    expect(() => assertUUID('not-a-uuid')).toThrow(/Invalid id/);
  });

  it('throws for a short numeric string "123"', () => {
    expect(() => assertUUID('123')).toThrow(/Invalid id/);
  });

  it('throws for an empty string', () => {
    expect(() => assertUUID('')).toThrow(/Invalid id/);
  });

  it('throws for a SQL injection payload "1\' OR \'1\'=\'1"', () => {
    expect(() => assertUUID("1' OR '1'='1")).toThrow(/Invalid id/);
  });

  it('throws for a UNION-based SQL injection string', () => {
    expect(() =>
      assertUUID("' UNION SELECT table_name FROM information_schema.tables--")
    ).toThrow(/Invalid id/);
  });

  it('throws for a UUID missing one segment', () => {
    // Only 4 groups instead of 5
    expect(() => assertUUID('550e8400-e29b-41d4-a716')).toThrow(/Invalid id/);
  });

  it('throws for a UUID with an extra character in a segment', () => {
    expect(() =>
      assertUUID('550e8400x-e29b-41d4-a716-446655440000')
    ).toThrow(/Invalid id/);
  });

  it('throws for a UUID with hyphens in wrong positions', () => {
    expect(() =>
      assertUUID('550e840-0e29b-41d4-a716-446655440000')
    ).toThrow(/Invalid id/);
  });

  it('throws for whitespace-only input', () => {
    expect(() => assertUUID('   ')).toThrow(/Invalid id/);
  });

  it('throws for a UUID with surrounding whitespace', () => {
    // Spaces around an otherwise valid UUID should still fail
    expect(() =>
      assertUUID(' 550e8400-e29b-41d4-a716-446655440000 ')
    ).toThrow(/Invalid id/);
  });

  it('throws for a UUID with non-hex characters', () => {
    expect(() =>
      assertUUID('gggggggg-gggg-gggg-gggg-gggggggggggg')
    ).toThrow(/Invalid id/);
  });

  it('throws for a null-byte injection attempt', () => {
    expect(() => assertUUID('\x00')).toThrow(/Invalid id/);
  });
});
