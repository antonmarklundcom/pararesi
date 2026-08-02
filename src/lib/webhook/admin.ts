import { requireAdmin } from "@/lib/auth";
import { replayWebhookEvent } from "./handlers";
import { productionWebhookDeps } from "./deps";
import type { WebhookEventRecord } from "./types";

/**
 * Backend for the /admin/webhooks page (B3 in docs/07-review-and-next-steps.md).
 * The page itself is not built yet — this module is everything it needs: a
 * listing query, a derived status, and a replay. The server-action wrapper for
 * the replay button lives in src/app/admin/webhooks/actions.ts.
 */

export const DEFAULT_LIMIT = 100;

export type WebhookEventStatus = "processed" | "failed" | "pending";

export type WebhookEventSummary = {
  id: number;
  lsEventId: string;
  eventName: string;
  status: WebhookEventStatus;
  error: string | null;
  processedAt: Date | null;
  createdAt: Date | null;
};

/**
 * A row is `failed` if it carries an error, `processed` once it has a
 * processedAt, and `pending` otherwise — which in practice means the process
 * died mid-handler, since processWebhook always writes one or the other.
 */
export function webhookEventStatus(event: Pick<WebhookEventRecord, "error" | "processedAt">): WebhookEventStatus {
  if (event.error) return "failed";
  if (event.processedAt) return "processed";
  return "pending";
}

export function toWebhookEventSummary(event: WebhookEventRecord): WebhookEventSummary {
  return {
    id: event.id,
    lsEventId: event.lsEventId,
    eventName: event.eventName,
    status: webhookEventStatus(event),
    error: event.error,
    processedAt: event.processedAt,
    createdAt: event.createdAt ?? null,
  };
}

/** Counts by status, for an at-a-glance banner on the admin dashboard. */
export function countByStatus(events: WebhookEventSummary[]): Record<WebhookEventStatus, number> {
  const counts: Record<WebhookEventStatus, number> = { processed: 0, failed: 0, pending: 0 };
  for (const event of events) counts[event.status] += 1;
  return counts;
}

/** Most recent first. Admin-only — call from a server component or action. */
export async function listRecentWebhookEvents(limit = DEFAULT_LIMIT): Promise<WebhookEventSummary[]> {
  await requireAdmin();
  const events = await productionWebhookDeps().store.listRecentWebhookEvents(limit);
  return events.map(toWebhookEventSummary);
}

export type ReplayResult = { ok: true } | { ok: false; error: string };

/**
 * Re-runs a logged event's stored payload through the current handlers. Safe
 * to press twice: the handlers look up purchases and subscriptions before
 * inserting, and compute tier/tierExpiresAt from the payload rather than
 * incrementing, so a replay converges on the same state.
 *
 * It replays the payload as recorded, so replaying an old
 * subscription_payment_success re-fetches the subscription and applies its
 * CURRENT renews_at, not the one in effect when the event first arrived.
 */
export async function replayWebhookEventById(eventId: number): Promise<ReplayResult> {
  await requireAdmin();

  try {
    const result = await replayWebhookEvent(eventId, productionWebhookDeps());
    return result.status === "failed" ? { ok: false, error: result.error.message } : { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
