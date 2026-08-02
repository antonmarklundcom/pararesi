import crypto from "crypto";
import { describe, it, expect } from "vitest";
import { lsEventId, verifySignature, type LemonSqueezyPayload } from "./ls-webhook";

const SECRET = "test-webhook-secret";

function sign(body: string, secret = SECRET) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Two deliveries of subscription_payment_success for the SAME subscription,
 * one month apart. In the real Lemon Squeezy payload these are two distinct
 * `subscription-invoices` objects with different ids and different
 * updated_at stamps — see docs/07-review-and-next-steps.md B1/B2.
 */
function paymentSuccess(invoiceId: string, updatedAt: string): LemonSqueezyPayload {
  return {
    meta: { event_name: "subscription_payment_success" },
    data: {
      type: "subscription-invoices",
      id: invoiceId,
      attributes: {
        subscription_id: 2001,
        billing_reason: "renewal",
        status: "paid",
        updated_at: updatedAt,
      },
    },
  };
}

describe("verifySignature", () => {
  const body = JSON.stringify({ meta: { event_name: "order_created" } });

  it("accepts a correctly signed body", () => {
    expect(verifySignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a body signed with the wrong secret", () => {
    expect(verifySignature(body, sign(body, "wrong-secret"), SECRET)).toBe(false);
  });

  it("rejects a tampered body", () => {
    expect(verifySignature(body + " ", sign(body), SECRET)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifySignature(body, null, SECRET)).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing", () => {
    expect(verifySignature(body, "abc123", SECRET)).toBe(false);
  });
});

describe("lsEventId", () => {
  it("is stable across a retry of the identical delivery", () => {
    const payload = paymentSuccess("3001", "2026-08-17T00:00:00.000000Z");
    expect(lsEventId(payload)).toBe(lsEventId(payload));
  });

  it("distinguishes different event names for the same resource", () => {
    const created: LemonSqueezyPayload = {
      meta: { event_name: "subscription_created" },
      data: { type: "subscriptions", id: "2001", attributes: {} },
    };
    const cancelled: LemonSqueezyPayload = {
      meta: { event_name: "subscription_cancelled" },
      data: { type: "subscriptions", id: "2001", attributes: {} },
    };
    expect(lsEventId(created)).not.toBe(lsEventId(cancelled));
  });

  /**
   * DEFECT B1 (docs/07-review-and-next-steps.md), fixed. Was pinned with
   * `it.fails` in PR 1; the key now includes attributes.updated_at, so two
   * renewals of the same subscription no longer collide.
   */
  it("gives month 1 and month 2 renewals distinct keys", () => {
    const month1 = paymentSuccess("3001", "2026-08-17T00:00:00.000000Z");
    const month2 = paymentSuccess("3002", "2026-09-17T00:00:00.000000Z");

    expect(lsEventId(month1)).not.toBe(lsEventId(month2));
  });

  it("separates two events on the same resource id by updated_at", () => {
    // The worst case: same event name, same data.id — only updated_at differs.
    // This is what a cancel -> resume -> cancel sequence looks like.
    const first = paymentSuccess("2001", "2026-08-17T00:00:00.000000Z");
    const second = paymentSuccess("2001", "2026-09-17T00:00:00.000000Z");

    expect(lsEventId(first)).not.toBe(lsEventId(second));
  });

  it("falls back to event_name:id when a payload carries no updated_at", () => {
    const payload: LemonSqueezyPayload = {
      meta: { event_name: "subscription_created" },
      data: { type: "subscriptions", id: "2001", attributes: {} },
    };
    expect(lsEventId(payload)).toBe("subscription_created:2001");
  });

  it("stays inside the webhook_events.ls_event_id column width (varchar 128)", () => {
    const payload = paymentSuccess("999999999999", "2026-09-17T00:00:00.000000Z");
    expect(lsEventId(payload).length).toBeLessThanOrEqual(128);
  });
});
