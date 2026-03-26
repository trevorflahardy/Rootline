import { createClient } from "redis";

export class RateLimitError extends Error {
  retryAfter: number;

  constructor(retryAfter: number) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

let _client: ReturnType<typeof createClient> | null = null;

async function getClient() {
  if (!_client) {
    _client = createClient({ url: process.env.REDIS_URL });
    _client.on("error", (err) => console.error("[rate-limit] Redis error:", err));
    await _client.connect();
  }
  return _client;
}

/**
 * Enforces a sliding-window counter rate limit backed by Redis.
 *
 * @param userId   - Clerk user ID
 * @param action   - Logical action name (e.g. "createMember")
 * @param limit    - Maximum allowed calls within the window
 * @param windowMs - Window length in milliseconds
 * @throws RateLimitError when the limit is exceeded
 */
export async function rateLimit(
  userId: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<void> {
  const key = `rl:${userId}:${action}`;
  const redis = await getClient();

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.pExpire(key, windowMs);
  }

  if (count > limit) {
    const ttl = await redis.pTTL(key);
    throw new RateLimitError(Math.ceil(Math.max(ttl, 0) / 1000));
  }
}
