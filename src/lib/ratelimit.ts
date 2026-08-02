// In-memory fixed-window rate limiter.
//
// The process-local Map is INTENTIONAL, not a shortcut to be "fixed" later.
// Hostinger runs this app as a single long-lived Node process — no serverless
// fan-out, no second instance — so one Map is a complete and consistent view
// of the traffic being limited. Adding Redis (or any external store) would buy
// nothing here and would introduce a network dependency on the login path,
// which is strictly worse: an unreachable store either locks everyone out or
// silently disables the limiter.
//
// The known trade-off, accepted: buckets reset on every deploy and restart, so
// an attacker who can time a deploy gets a fresh window. Against password
// guessing that is immaterial next to bcrypt's cost, and deploys are rare.
//
// This stops being true the moment the app runs on more than one process —
// multiple PM2 instances, a second Hostinger slot behind a load balancer, or a
// move to serverless. That, and only that, is the trigger for a shared store.
// See docs/02-architecture.md for the single-process stack rule.

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
