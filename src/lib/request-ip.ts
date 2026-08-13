import { headers } from "next/headers";

/**
 * `x-forwarded-for` is a list that each hop *appends* to, and the left-hand
 * entries are whatever the client sent. Reading the leftmost entry therefore
 * reads a value the caller chose: an attacker sets a different one on every
 * request and every IP-keyed rate limit in the app becomes a no-op.
 *
 * The rightmost entry is the address the nearest proxy observed, which is the
 * only one no client can forge. With more than one trusted proxy in front of
 * the app (a CDN plus the host's own reverse proxy, say), the real client is
 * that many entries in from the right — hence TRUSTED_PROXY_HOPS. The default
 * of 1 matches the documented deployment: one Node process behind Hostinger's
 * proxy (docs/02-architecture.md).
 *
 * Getting the hop count too *low* is the safe direction: it buckets several
 * clients together and rate-limits more aggressively. Too high hands the
 * attacker the header back, which is why it is not the default.
 */
export function parseForwardedFor(header: string | null, hops: number): string | null {
  if (!header) return null;

  const entries = header
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (entries.length === 0) return null;

  const index = entries.length - Math.max(1, hops);
  return entries[Math.max(0, index)] ?? null;
}

export function trustedProxyHops(): number {
  const raw = Number(process.env.TRUSTED_PROXY_HOPS);
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
}

/** Best-effort client IP from the reverse proxy. Falls back to a constant
 * bucket if unavailable — rate limiting still works per-email either way. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return parseForwardedFor(h.get("x-forwarded-for"), trustedProxyHops()) ?? h.get("x-real-ip") ?? "unknown";
}
