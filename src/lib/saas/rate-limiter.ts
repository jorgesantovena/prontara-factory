/**
 * In-memory rate limiter for sensitive endpoints (login, activation, etc).
 *
 * Scope: single Node process. If Prontara is ever run behind multiple
 * concurrent workers (PM2 cluster, k8s replicas), this should be replaced
 * with a Redis-backed counter. For the current single-instance runtime it is
 * sufficient to stop credential-stuffing attacks against the login endpoint.
 *
 * Strategy: fixed-window per key. Each key accumulates attempts inside a
 * time window; when the limit is reached, further attempts are rejected
 * until the window expires.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/**
 * Prunes expired buckets lazily every N calls to avoid unbounded growth on
 * long-lived processes.
 */
let cleanupCounter = 0;
function maybeCleanup(now: number) {
  cleanupCounter += 1;
  if (cleanupCounter < 500) {
    return;
  }
  cleanupCounter = 0;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimitOptions = {
  /** Identifier (e.g. `login:<ip>:<email>`). */
  key: string;
  /** Max attempts inside the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
};

/**
 * Registers a single attempt and returns whether it is allowed.
 * Callers must invoke this BEFORE performing the sensitive operation so
 * that rejected attempts still count.
 */
export function consumeRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  maybeCleanup(now);

  const existing = buckets.get(options.key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(options.key, { count: 1, resetAt: now + options.windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, options.limit - 1),
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, options.limit - existing.count),
    retryAfterSeconds: 0,
  };
}

/**
 * Resets a key's counter — call this after a successful login so that a
 * legitimate user doesn't get locked out by earlier failed attempts.
 */
export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

/**
 * Extracts a best-effort client IP from a NextRequest. Uses the standard
 * proxy headers and falls back to a static value so the limiter still works
 * in local development.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  const real = headers.get("x-real-ip");
  if (real && real.trim()) {
    return real.trim();
  }
  return "unknown";
}
