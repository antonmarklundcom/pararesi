// Cookieless analytics (Plausible), env-var driven. Every export here is a
// no-op when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is unset, so an owner who never
// creates a Plausible site pays no cost and sends no requests — including in
// tests and CI, where the env var is never set.

type AnalyticsEventProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: AnalyticsEventProps }) => void;
  }
}

function domain(): string | undefined {
  return process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
}

/** Fires a custom event from the browser. Safe to call unconditionally. */
export function trackClientEvent(name: string, props?: AnalyticsEventProps): void {
  if (typeof window === "undefined" || typeof window.plausible !== "function") return;
  window.plausible(name, props ? { props } : undefined);
}

/**
 * Fires a custom event from the server via Plausible's Events API — used for
 * "purchase completed", which is only known once the webhook confirms it,
 * not from a client-side success page (there isn't one; Lemon Squeezy
 * confirms by webhook + email, see docs/02-architecture.md).
 */
export async function trackServerEvent(name: string, props?: AnalyticsEventProps): Promise<void> {
  const d = domain();
  if (!d) return;

  try {
    await fetch("https://plausible.io/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, domain: d, url: `https://${d}/`, props }),
      // The only caller on a hot path is the Lemon Squeezy webhook handler,
      // which awaits this. Without a deadline, a Plausible outage that hangs
      // rather than refusing the connection holds the webhook open until Lemon
      // Squeezy gives up and retries — turning an analytics blip into a
      // customer who paid and is waiting for access.
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Analytics must never affect the caller — e.g. a Plausible outage must
    // not fail webhook processing.
  }
}
