import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  rateLimit,
  RateLimitError,
  rateLimitHeaders,
} from '../../src/lib/rate-limit';
import { rateLimitHeaders as rateLimitHeadersStandalone } from '../../src/lib/rate-limit-headers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Generate a unique userId per test so the in-module Map never carries state
 * between tests (avoids ordering-dependent failures).
 */
let testCounter = 0;
function uniqueUser(): string {
  return `test-user-${++testCounter}`;
}

// ---------------------------------------------------------------------------
// rateLimit — basic happy path
// ---------------------------------------------------------------------------
describe('rateLimit — under limit', () => {
  it('does not throw when called exactly at the limit boundary', () => {
    const userId = uniqueUser();
    // limit = 3, so calls 1-3 must all succeed
    expect(() => rateLimit(userId, 'action', 3, 60_000)).not.toThrow();
    expect(() => rateLimit(userId, 'action', 3, 60_000)).not.toThrow();
    expect(() => rateLimit(userId, 'action', 3, 60_000)).not.toThrow();
  });

  it('does not throw for a single call with a limit of 1', () => {
    const userId = uniqueUser();
    expect(() => rateLimit(userId, 'action', 1, 60_000)).not.toThrow();
  });

  it('tracks different users independently', () => {
    const userA = uniqueUser();
    const userB = uniqueUser();
    // Both can make their first call without interference
    expect(() => rateLimit(userA, 'action', 1, 60_000)).not.toThrow();
    expect(() => rateLimit(userB, 'action', 1, 60_000)).not.toThrow();
  });

  it('tracks different actions for the same user independently', () => {
    const userId = uniqueUser();
    expect(() => rateLimit(userId, 'actionA', 1, 60_000)).not.toThrow();
    expect(() => rateLimit(userId, 'actionB', 1, 60_000)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// rateLimit — over limit
// ---------------------------------------------------------------------------
describe('rateLimit — over limit', () => {
  it('throws RateLimitError on the call that exceeds the limit', () => {
    const userId = uniqueUser();
    rateLimit(userId, 'create', 2, 60_000); // call 1 — ok
    rateLimit(userId, 'create', 2, 60_000); // call 2 — ok (hits limit exactly)
    expect(() => rateLimit(userId, 'create', 2, 60_000)).toThrow(RateLimitError);
  });

  it('throws with a retryAfter value that is a positive number', () => {
    const userId = uniqueUser();
    rateLimit(userId, 'create', 1, 60_000); // exhausts the single-call window
    let caught: RateLimitError | undefined;
    try {
      rateLimit(userId, 'create', 1, 60_000);
    } catch (err) {
      caught = err as RateLimitError;
    }
    expect(caught).toBeInstanceOf(RateLimitError);
    expect(typeof caught!.retryAfter).toBe('number');
    expect(caught!.retryAfter).toBeGreaterThan(0);
  });

  it('retryAfter is approximately the remaining window in seconds', () => {
    const userId = uniqueUser();
    const windowMs = 30_000; // 30 s
    rateLimit(userId, 'upload', 1, windowMs);
    try {
      rateLimit(userId, 'upload', 1, windowMs);
    } catch (err) {
      const e = err as RateLimitError;
      // retryAfter must be <= ceil(windowMs / 1000) and > 0
      expect(e.retryAfter).toBeGreaterThan(0);
      expect(e.retryAfter).toBeLessThanOrEqual(Math.ceil(windowMs / 1000));
    }
  });

  it('error message includes "Rate limit exceeded"', () => {
    const userId = uniqueUser();
    rateLimit(userId, 'msg', 1, 60_000);
    expect(() => rateLimit(userId, 'msg', 1, 60_000)).toThrow(
      /Rate limit exceeded/i
    );
  });

  it('error name is "RateLimitError"', () => {
    const userId = uniqueUser();
    rateLimit(userId, 'name-check', 1, 60_000);
    let caught: RateLimitError | undefined;
    try {
      rateLimit(userId, 'name-check', 1, 60_000);
    } catch (err) {
      caught = err as RateLimitError;
    }
    expect(caught?.name).toBe('RateLimitError');
  });
});

// ---------------------------------------------------------------------------
// rateLimit — window reset (mocked Date.now)
// ---------------------------------------------------------------------------
describe('rateLimit — window reset', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows calls again after the window expires', () => {
    const userId = uniqueUser();
    const windowMs = 10_000; // 10 s

    // Exhaust the limit
    rateLimit(userId, 'reset-action', 1, windowMs);
    expect(() => rateLimit(userId, 'reset-action', 1, windowMs)).toThrow(
      RateLimitError
    );

    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 1);

    // Should succeed again — window has reset
    expect(() => rateLimit(userId, 'reset-action', 1, windowMs)).not.toThrow();
  });

  it('does not reset before the window expires', () => {
    const userId = uniqueUser();
    const windowMs = 10_000;

    rateLimit(userId, 'no-reset', 1, windowMs);
    vi.advanceTimersByTime(windowMs - 1); // one millisecond before expiry
    expect(() => rateLimit(userId, 'no-reset', 1, windowMs)).toThrow(
      RateLimitError
    );
  });

  it('starts a fresh counter after the reset', () => {
    const userId = uniqueUser();
    const windowMs = 5_000;
    const limit = 3;

    // Use up 3 calls in window 1
    rateLimit(userId, 'fresh', limit, windowMs);
    rateLimit(userId, 'fresh', limit, windowMs);
    rateLimit(userId, 'fresh', limit, windowMs);
    expect(() => rateLimit(userId, 'fresh', limit, windowMs)).toThrow(
      RateLimitError
    );

    // Advance past the window
    vi.advanceTimersByTime(windowMs + 1);

    // All 3 quota calls in window 2 must succeed
    expect(() => rateLimit(userId, 'fresh', limit, windowMs)).not.toThrow();
    expect(() => rateLimit(userId, 'fresh', limit, windowMs)).not.toThrow();
    expect(() => rateLimit(userId, 'fresh', limit, windowMs)).not.toThrow();
    // 4th call in window 2 must fail
    expect(() => rateLimit(userId, 'fresh', limit, windowMs)).toThrow(
      RateLimitError
    );
  });
});

// ---------------------------------------------------------------------------
// RateLimitResult — return value metadata
// ---------------------------------------------------------------------------
describe('rateLimit — RateLimitResult', () => {
  it('returns an object with limit, remaining, and reset', () => {
    const userId = uniqueUser();
    const result = rateLimit(userId, 'meta', 5, 60_000);
    expect(result).toHaveProperty('limit', 5);
    expect(result).toHaveProperty('remaining', 4);
    expect(typeof result.reset).toBe('number');
    expect(result.reset).toBeGreaterThan(0);
  });

  it('decrements remaining with each call', () => {
    const userId = uniqueUser();
    const r1 = rateLimit(userId, 'dec', 3, 60_000);
    const r2 = rateLimit(userId, 'dec', 3, 60_000);
    const r3 = rateLimit(userId, 'dec', 3, 60_000);

    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(1);
    expect(r3.remaining).toBe(0);
  });

  it('remaining never goes below zero in the result', () => {
    const userId = uniqueUser();
    const result = rateLimit(userId, 'floor', 1, 60_000);
    expect(result.remaining).toBe(0); // 1 call with limit 1 → 0 remaining
  });

  it('reset is a Unix timestamp in seconds in the future', () => {
    const userId = uniqueUser();
    const nowSec = Math.floor(Date.now() / 1000);
    const result = rateLimit(userId, 'ts', 5, 60_000);
    expect(result.reset).toBeGreaterThanOrEqual(nowSec);
    expect(result.reset).toBeLessThanOrEqual(nowSec + 61);
  });
});

// ---------------------------------------------------------------------------
// RateLimitError — headers property
// ---------------------------------------------------------------------------
describe('RateLimitError — headers', () => {
  it('has a headers getter with X-RateLimit-* keys', () => {
    const userId = uniqueUser();
    rateLimit(userId, 'hdr', 1, 60_000); // exhaust limit
    let caught: RateLimitError | undefined;
    try {
      rateLimit(userId, 'hdr', 1, 60_000);
    } catch (err) {
      caught = err as RateLimitError;
    }
    expect(caught).toBeInstanceOf(RateLimitError);
    const hdrs = caught!.headers;
    expect(hdrs).toHaveProperty('X-RateLimit-Limit');
    expect(hdrs).toHaveProperty('X-RateLimit-Remaining');
    expect(hdrs).toHaveProperty('X-RateLimit-Reset');
  });

  it('header values are strings', () => {
    const userId = uniqueUser();
    rateLimit(userId, 'hdr-str', 1, 60_000);
    let caught: RateLimitError | undefined;
    try {
      rateLimit(userId, 'hdr-str', 1, 60_000);
    } catch (err) {
      caught = err as RateLimitError;
    }
    const hdrs = caught!.headers;
    expect(typeof hdrs['X-RateLimit-Limit']).toBe('string');
    expect(typeof hdrs['X-RateLimit-Remaining']).toBe('string');
    expect(typeof hdrs['X-RateLimit-Reset']).toBe('string');
  });

  it('X-RateLimit-Remaining is "0" when over limit', () => {
    const userId = uniqueUser();
    rateLimit(userId, 'hdr-zero', 1, 60_000);
    let caught: RateLimitError | undefined;
    try {
      rateLimit(userId, 'hdr-zero', 1, 60_000);
    } catch (err) {
      caught = err as RateLimitError;
    }
    expect(caught!.headers['X-RateLimit-Remaining']).toBe('0');
  });

  it('X-RateLimit-Limit matches the configured limit', () => {
    const userId = uniqueUser();
    rateLimit(userId, 'hdr-lim', 1, 60_000);
    let caught: RateLimitError | undefined;
    try {
      rateLimit(userId, 'hdr-lim', 1, 60_000);
    } catch (err) {
      caught = err as RateLimitError;
    }
    expect(caught!.headers['X-RateLimit-Limit']).toBe('1');
  });

  it('includes limit, remaining, and reset numeric properties', () => {
    const userId = uniqueUser();
    rateLimit(userId, 'hdr-props', 2, 30_000);
    rateLimit(userId, 'hdr-props', 2, 30_000);
    let caught: RateLimitError | undefined;
    try {
      rateLimit(userId, 'hdr-props', 2, 30_000);
    } catch (err) {
      caught = err as RateLimitError;
    }
    expect(caught!.limit).toBe(2);
    expect(caught!.remaining).toBe(0);
    expect(caught!.reset).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// rateLimitHeaders — standalone helper
// ---------------------------------------------------------------------------
describe('rateLimitHeaders', () => {
  it('formats a RateLimitResult into X-RateLimit-* headers', () => {
    const result = rateLimit(uniqueUser(), 'fmt', 10, 60_000);
    const hdrs = rateLimitHeaders(result);
    expect(hdrs['X-RateLimit-Limit']).toBe('10');
    expect(hdrs['X-RateLimit-Remaining']).toBe('9');
    expect(hdrs['X-RateLimit-Reset']).toBe(String(result.reset));
  });

  it('clamps remaining to 0 when negative', () => {
    const hdrs = rateLimitHeaders({ limit: 5, remaining: -1, reset: 999 });
    expect(hdrs['X-RateLimit-Remaining']).toBe('0');
  });

  it('returns only the three expected header keys', () => {
    const hdrs = rateLimitHeaders({ limit: 1, remaining: 0, reset: 123 });
    expect(Object.keys(hdrs).sort()).toEqual([
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ]);
  });
});

// ---------------------------------------------------------------------------
// rateLimitHeaders — standalone module (rate-limit-headers.ts)
// ---------------------------------------------------------------------------
describe('rateLimitHeaders standalone module', () => {
  it('produces identical output to the inline helper', () => {
    const result = rateLimit(uniqueUser(), 'standalone', 5, 60_000);
    const fromInline = rateLimitHeaders(result);
    const fromStandalone = rateLimitHeadersStandalone(result);
    expect(fromStandalone).toEqual(fromInline);
  });

  it('formats correctly with edge values', () => {
    const hdrs = rateLimitHeadersStandalone({
      limit: 0,
      remaining: 0,
      reset: 0,
    });
    expect(hdrs['X-RateLimit-Limit']).toBe('0');
    expect(hdrs['X-RateLimit-Remaining']).toBe('0');
    expect(hdrs['X-RateLimit-Reset']).toBe('0');
  });
});
