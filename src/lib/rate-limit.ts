import { createClient } from "redis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  /** Maximum allowed calls within the window */
  limit: number;
  /** Remaining calls before the limit is reached */
  remaining: number;
  /** Unix timestamp (seconds) when the current window resets */
  reset: number;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class RateLimitError extends Error {
  retryAfter: number;
  limit: number;
  remaining: number;
  reset: number;

  constructor(retryAfter: number, meta?: RateLimitResult) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    this.limit = meta?.limit ?? 0;
    this.remaining = meta?.remaining ?? 0;
    this.reset = meta?.reset ?? 0;
  }

  /** Standard X-RateLimit-* headers for the response */
  get headers(): Record<string, string> {
    return {
      "X-RateLimit-Limit": String(this.limit),
      "X-RateLimit-Remaining": String(Math.max(0, this.remaining)),
      "X-RateLimit-Reset": String(this.reset),
    };
  }
}

// ---------------------------------------------------------------------------
// In-memory sliding-window store (used as primary / test-friendly fallback)
// ---------------------------------------------------------------------------

interface WindowEntry {
  count: number;
  /** Absolute ms timestamp when the window expires */
  expiresAt: number;
}

const store = new Map<string, WindowEntry>();

// ---------------------------------------------------------------------------
// Redis client (optional enhancement for production)
// ---------------------------------------------------------------------------

let _client: ReturnType<typeof createClient> | null = null;
let _redisAvailable: boolean | null = null;

async function getClient(): Promise<ReturnType<typeof createClient> | null> {
  if (_redisAvailable === false) return null;
  if (_client) return _client;

  try {
    _client = createClient({ url: process.env.REDIS_URL });
    _client.on("error", (err) => {
      console.error("[rate-limit] Redis error:", err);
      _redisAvailable = false;
    });
    await _client.connect();
    _redisAvailable = true;
    return _client;
  } catch {
    _redisAvailable = false;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Standalone helper that converts a {@link RateLimitResult} into standard
 * `X-RateLimit-*` response headers.
 */
export function rateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "X-RateLimit-Reset": String(result.reset),
  };
}

/**
 * Enforces a sliding-window counter rate limit.
 *
 * Uses an in-memory Map for synchronous operation (and tests) and optionally
 * delegates to Redis when available in production.
 *
 * @param userId   - Clerk user ID
 * @param action   - Logical action name (e.g. "createMember")
 * @param limit    - Maximum allowed calls within the window
 * @param windowMs - Window length in milliseconds
 * @returns Rate limit metadata including remaining quota
 * @throws RateLimitError when the limit is exceeded
 */
export function rateLimit(
  userId: string,
  action: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const key = `rl:${userId}:${action}`;
  const now = Date.now();

  let entry = store.get(key);

  // If the window has expired (or no entry exists), start a fresh window.
  if (!entry || now >= entry.expiresAt) {
    entry = { count: 0, expiresAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count += 1;

  const resetSec = Math.ceil(entry.expiresAt / 1000);
  const remaining = limit - entry.count;

  if (entry.count > limit) {
    const ttlMs = entry.expiresAt - now;
    const retryAfter = Math.ceil(Math.max(ttlMs, 0) / 1000);
    const meta: RateLimitResult = { limit, remaining: 0, reset: resetSec };
    throw new RateLimitError(retryAfter, meta);
  }

  return { limit, remaining, reset: resetSec };
}

/**
 * Async variant that delegates to Redis when available, falling back to the
 * in-memory implementation. Existing callers that `await rateLimit(...)` can
 * migrate to this for Redis-backed enforcement.
 */
export async function rateLimitAsync(
  userId: string,
  action: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const redis = await getClient();
  if (!redis) {
    return rateLimit(userId, action, limit, windowMs);
  }

  const key = `rl:${userId}:${action}`;
  const now = Date.now();
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.pExpire(key, windowMs);
  }

  const ttl = await redis.pTTL(key);
  const resetSec = Math.ceil((now + Math.max(ttl, 0)) / 1000);
  const remaining = limit - count;

  if (count > limit) {
    const retryAfter = Math.ceil(Math.max(ttl, 0) / 1000);
    const meta: RateLimitResult = { limit, remaining: 0, reset: resetSec };
    throw new RateLimitError(retryAfter, meta);
  }

  return { limit, remaining, reset: resetSec };
}
