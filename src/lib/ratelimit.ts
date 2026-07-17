// In-memory fixed-window rate limiter. Correct here because Hostinger runs
// this app as a single Node process (no serverless/multi-instance fan-out).

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Periodic sweep so long-lived keys (e.g. one-off login attempts) don't
// accumulate forever in memory over the app's uptime.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}, SWEEP_INTERVAL_MS).unref();

/** Returns true if the action is allowed, false if the caller is rate-limited. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}
