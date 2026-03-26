/**
 * WARNING: SERVERLESS LIMITATION: This rate limiter uses in-memory state.
 * In serverless/edge environments (Vercel, AWS Lambda), each function invocation
 * may run in a fresh process, resetting all counters. This means rate limits
 * are NOT reliably enforced in production serverless deployments.
 *
 * For production use, replace with a persistent store:
 *   - Upstash Redis: @upstash/ratelimit (https://github.com/upstash/ratelimit)
 *   - Vercel KV: @vercel/kv
 *   - Redis via ioredis
 *
 * Example with Upstash:
 *   import { Ratelimit } from "@upstash/ratelimit";
 *   import { Redis } from "@upstash/redis";
 */

/**
 * In-memory token bucket rate limiter.
 * Keyed by `${userId}:${action}`. Resets after windowMs milliseconds.
 */

export class RateLimitError extends Error {
  retryAfter: number;

  constructor(retryAfter: number) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

interface BucketEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, BucketEntry>();

/**
 * Enforces a sliding-window counter rate limit.
 *
 * @param userId   - Clerk user ID
 * @param action   - Logical action name (e.g. "createMember")
 * @param limit    - Maximum allowed calls within the window
 * @param windowMs - Window length in milliseconds
 * @throws RateLimitError when the limit is exceeded
 */
export function rateLimit(
  userId: string,
  action: string,
  limit: number,
  windowMs: number
): void {
  const key = `${userId}:${action}`;
  const now = Date.now();

  const entry = buckets.get(key);

  if (!entry || now >= entry.resetAt) {
    // Start a fresh window
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    throw new RateLimitError(retryAfter);
  }

  entry.count += 1;
}
