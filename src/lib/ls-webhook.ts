import crypto from "crypto";

/**
 * The JSON:API envelope every Lemon Squeezy webhook arrives in. `data.type`
 * varies by event — `orders` for order_*, `subscriptions` for subscription_*,
 * and `subscription-invoices` for the subscription_payment_* family — so
 * `attributes` is deliberately untyped here and narrowed per handler.
 */
export type LemonSqueezyPayload = {
  meta: { event_name: string; custom_data?: Record<string, string> };
  data: { id: string; type: string; attributes: Record<string, unknown> };
};

/**
 * The idempotency key stored in `webhook_events.ls_event_id`. Lemon Squeezy
 * doesn't send a dedicated delivery id, so this is derived from the payload:
 * a retried delivery of the same event must collapse to the same key, while
 * two genuinely distinct events must not.
 */
export function lsEventId(payload: LemonSqueezyPayload): string {
  const eventName = payload.meta?.event_name ?? "unknown";
  const resourceId = payload.data?.id ?? "unknown";
  return `${eventName}:${resourceId}`;
}

/** Constant-time HMAC-SHA256 check of the raw request body against `x-signature`. */
export function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const digestBuffer = Buffer.from(digest, "utf8");
  const signatureBuffer = Buffer.from(signatureHeader, "utf8");
  if (digestBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(digestBuffer, signatureBuffer);
}
