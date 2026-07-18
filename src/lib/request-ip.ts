import { headers } from "next/headers";

/** Best-effort client IP from the reverse proxy. Falls back to a constant
 * bucket if unavailable — rate limiting still works per-email either way. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
