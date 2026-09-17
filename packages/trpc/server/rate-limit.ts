import { TRPCError } from "@trpc/server";

type Bucket = { count: number; resetAt: number };

// Per-instance fixed-window counters. Keyed by `${action}:${actor}`.
const buckets = new Map<string, Bucket>();

let lastSweep = Date.now();
function sweepExpired(now: number) {
  // Bound memory: drop expired buckets at most once a minute.
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitOptions = {
  /** Unique key for the action + actor, e.g. `prd-generate:${userId}`. */
  key: string;
  /** Max calls allowed within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Optional override for the throttled error message. */
  message?: string;
};

/**
 * Fixed-window in-memory rate limiter. Guards expensive AI mutations (PRD/task
 * generation, clarification turns) against accidental double-clicks, runaway
 * retries, and bill-draining floods. Scoped per server instance — adequate for
 * a single-region deployment; swap in a shared store (Redis/Upstash) before
 * scaling horizontally.
 *
 * Throws TRPCError(TOO_MANY_REQUESTS) once the window budget is exhausted.
 */
export function enforceRateLimit({ key, limit, windowMs, message }: RateLimitOptions): void {
  const now = Date.now();
  sweepExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: message ?? `Too many requests — please wait ${retryAfter}s and try again.`,
    });
  }

  bucket.count += 1;
}
