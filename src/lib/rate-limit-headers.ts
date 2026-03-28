import type { RateLimitResult } from "./rate-limit";

/**
 * Converts a {@link RateLimitResult} into standard `X-RateLimit-*` response
 * headers suitable for inclusion in HTTP responses.
 *
 * @example
 * ```ts
 * const result = rateLimit(userId, 'createMember', 20, 60_000);
 * const headers = rateLimitHeaders(result);
 * // { 'X-RateLimit-Limit': '20', 'X-RateLimit-Remaining': '19', 'X-RateLimit-Reset': '...' }
 * ```
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
