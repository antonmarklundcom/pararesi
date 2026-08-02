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
   * PINS DEFECT B1 (docs/07-review-and-next-steps.md).
   *
   * `it.fails` asserts that this expectation currently does NOT hold — so CI
   * stays green while the bug is documented in executable form. PR 2 fixes
   * the key derivation, at which point this test starts passing, `it.fails`
   * starts failing, and it must be flipped back to a plain `it`.
   *
   * Today the key is `${event_name}:${data.id}`. For subscription events
   * data.id is the subscription id, stable for the subscription's whole life,
   * so month 2's renewal collapses onto month 1's key and is dropped as a
   * duplicate — the member's tierExpiresAt is never extended.
   */
  it.fails("gives month 1 and month 2 renewals distinct keys [B1 — expected to fail until PR 2]", () => {
    const month1 = paymentSuccess("3001", "2026-08-17T00:00:00.000000Z");
    const month2 = paymentSuccess("3002", "2026-09-17T00:00:00.000000Z");

    // Simulating the *old* payload shape the current handler was written
    // against: same `subscriptions` object id on every renewal.
    const asOldShape = (p: LemonSqueezyPayload): LemonSqueezyPayload => ({
      ...p,
      data: { ...p.data, type: "subscriptions", id: "2001" },
    });

    expect(lsEventId(asOldShape(month1))).not.toBe(lsEventId(asOldShape(month2)));
  });
});
