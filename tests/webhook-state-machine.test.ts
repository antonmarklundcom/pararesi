import { describe, it, expect, beforeEach } from "vitest";
import { processWebhook } from "@/lib/webhook/handlers";
import { TIER_GRACE_DAYS } from "@/lib/webhook/types";
import { apiFixture, fixture, harness, plusGraceDays, type TestHarness } from "./support/memory-store";

const JANE = "jane.buyer@example.com";
const SAM = "sam.insider@example.com";

/** The subscription as the Lemon Squeezy API reports it during each phase. */
const SUB_AFTER_SIGNUP = fixture("subscription_created").data;
const SUB_AFTER_MONTH2 = apiFixture("subscription_2001_after_month2_renewal").data;

let h: TestHarness;

beforeEach(() => {
  h = harness();
  h.subscriptionApi.set("2001", SUB_AFTER_SIGNUP);
});

async function send(name: string) {
  const result = await processWebhook(fixture(name), h.deps);
  if (result.status === "failed") throw result.error;
  return result;
}

describe("order_created", () => {
  it("creates the user, records the purchase, grants guide and sends the set-password email", async () => {
    await send("order_created");

    const jane = h.store.userByEmail(JANE);
    expect(jane.tier).toBe("guide");
    expect(jane.tierExpiresAt).toBeNull(); // one-time purchase, never expires
    expect(h.store.lsCustomerIds.get(jane.id)).toBe("5001");

    expect(h.store.purchases).toHaveLength(1);
    expect(h.store.purchases[0]).toMatchObject({ lsOrderId: "1001", productKey: "guide", status: "paid" });

    expect(h.emails).toHaveLength(1);
    expect(h.emails[0].template).toBe("welcome-set-password");
    expect(h.emails[0].to).toBe(JANE);
    expect(h.tokens).toEqual([{ userId: jane.id, purpose: "set" }]);
  });

  it("sends payment-received instead of a welcome email when the buyer already has an account", async () => {
    await send("order_created");
    h.emails.length = 0;

    // A second, different order from the same email address.
    const second = fixture("order_created");
    second.data.id = "1099";
    (second.data.attributes as Record<string, unknown>).updated_at = "2026-07-18T00:00:00.000000Z";
    await processWebhook(second, h.deps);

    expect(h.store.users).toHaveLength(1);
    expect(h.emails.map((e) => e.template)).toEqual(["payment-received"]);
  });
});

describe("subscription_created", () => {
  it("creates the subscription and puts the member on insider until renews_at + grace", async () => {
    await send("subscription_created");

    const sam = h.store.userByEmail(SAM);
    expect(sam.tier).toBe("insider");
    expect(sam.tierExpiresAt).toEqual(plusGraceDays("2026-08-17T00:00:00.000000Z"));

    expect(h.store.subscriptions).toHaveLength(1);
    expect(h.store.subscriptions[0]).toMatchObject({ lsSubscriptionId: "2001", status: "active" });
    expect(h.emails.map((e) => e.template)).toEqual(["welcome-set-password"]);
  });
});

describe("subscription_payment_success", () => {
  /**
   * DEFECT B1 (docs/07-review-and-next-steps.md). Before the fix the month-2
   * invoice collapsed onto month 1's idempotency key and was dropped, so
   * tierExpiresAt stayed at month 1's value and the member lost access.
   */
  it("extends tierExpiresAt on the month-2 renewal", async () => {
    await send("subscription_created");
    await send("subscription_payment_success"); // month 1, billing_reason "initial"

    const afterMonth1 = h.store.userByEmail(SAM).tierExpiresAt;
    expect(afterMonth1).toEqual(plusGraceDays("2026-08-17T00:00:00.000000Z"));

    // Month 2: the subscription has since rolled forward to 2026-09-17.
    h.subscriptionApi.set("2001", SUB_AFTER_MONTH2);
    const result = await send("subscription_payment_success_month2");

    expect(result.status).toBe("processed");
    expect(h.store.userByEmail(SAM).tierExpiresAt).toEqual(plusGraceDays("2026-09-17T00:00:00.000000Z"));
    expect(h.store.subscriptions[0].renewsAt).toEqual(new Date("2026-09-17T00:00:00.000000Z"));
  });

  it("gives month 1 and month 2 distinct webhook_events rows", async () => {
    await send("subscription_created");
    await send("subscription_payment_success");
    h.subscriptionApi.set("2001", SUB_AFTER_MONTH2);
    await send("subscription_payment_success_month2");

    const paymentEvents = h.store.events.filter((e) => e.eventName === "subscription_payment_success");
    expect(paymentEvents).toHaveLength(2);
    expect(new Set(paymentEvents.map((e) => e.lsEventId)).size).toBe(2);
  });

  it("reads the paid-through date from the subscription API, not the invoice", async () => {
    await send("subscription_created");
    h.fetchCalls.length = 0;

    await send("subscription_payment_success");

    // The invoice payload has no renews_at at all, so the fetch is mandatory.
    expect(h.fetchCalls).toEqual(["2001"]);
    expect(fixture("subscription_payment_success").data.attributes.renews_at).toBeUndefined();
  });

  it("does not create a second user for the renewal invoice", async () => {
    await send("subscription_created");
    h.subscriptionApi.set("2001", SUB_AFTER_MONTH2);
    await send("subscription_payment_success_month2");

    expect(h.store.users).toHaveLength(1);
    expect(h.store.subscriptions).toHaveLength(1);
  });

  it("fails loudly when the subscription cannot be fetched", async () => {
    await send("subscription_created");
    h.subscriptionApi.clear();

    const result = await processWebhook(fixture("subscription_payment_success"), h.deps);

    expect(result.status).toBe("failed");
    expect(h.store.events.at(-1)?.error).toBeTruthy();
    expect(h.store.events.at(-1)?.processedAt).toBeNull();
  });
});

describe("subscription_cancelled", () => {
  it("keeps insider access until the paid period ends rather than downgrading immediately", async () => {
    await send("subscription_created");
    await send("subscription_cancelled");

    const sam = h.store.userByEmail(SAM);
    expect(sam.tier).toBe("insider"); // doc 06 R1: cancel is not the downgrade event
    expect(sam.tierExpiresAt).toEqual(plusGraceDays("2026-09-17T00:00:00.000000Z"));
    expect(h.store.subscriptions[0].status).toBe("cancelled");
  });

  /**
   * The other half of defect B1, and the one the real payload shape actually
   * exposes: two `subscription_cancelled` events carry the SAME event name and
   * the SAME data.id (the subscription id). Under the old
   * `event_name:data.id` key the second cancel was dropped as a duplicate.
   * Only attributes.updated_at tells them apart.
   */
  it("does not drop a second cancel after a resume", async () => {
    await send("subscription_created");
    await send("subscription_cancelled");
    await send("subscription_resumed");

    const recancel = fixture("subscription_cancelled");
    const attrs = recancel.data.attributes as Record<string, unknown>;
    attrs.updated_at = "2026-08-30T00:00:00.000000Z";
    attrs.ends_at = "2026-09-17T00:00:00.000000Z";

    const result = await processWebhook(recancel, h.deps);

    expect(result.status).toBe("processed");
    expect(h.store.subscriptions[0].status).toBe("cancelled");
    expect(h.store.events.filter((e) => e.eventName === "subscription_cancelled")).toHaveLength(2);
  });
});

describe("subscription_resumed / subscription_unpaused", () => {
  it("restores active status and re-extends tierExpiresAt", async () => {
    await send("subscription_created");
    await send("subscription_cancelled");
    await send("subscription_resumed");

    expect(h.store.subscriptions[0].status).toBe("active");
    expect(h.store.subscriptions[0].endsAt).toBeNull();
    expect(h.store.userByEmail(SAM).tierExpiresAt).toEqual(plusGraceDays("2026-09-17T00:00:00.000000Z"));
  });

  it("treats unpause the same way", async () => {
    await send("subscription_created");
    await send("subscription_unpaused");

    expect(h.store.subscriptions[0].status).toBe("active");
    expect(h.store.userByEmail(SAM).tier).toBe("insider");
  });
});

describe("subscription_expired", () => {
  it("drops a subscriber with no guide purchase to none", async () => {
    await send("subscription_created");
    await send("subscription_expired");

    const sam = h.store.userByEmail(SAM);
    expect(sam.tier).toBe("none");
    expect(sam.tierExpiresAt).toBeNull();
    expect(h.store.subscriptions[0].status).toBe("expired");
  });

  it("falls back to guide when the member also bought the guide", async () => {
    await send("subscription_created");
    // Same person buys the guide outright, under the same email.
    const order = fixture("order_created");
    (order.data.attributes as Record<string, unknown>).user_email = SAM;
    await processWebhook(order, h.deps);

    await send("subscription_expired");

    expect(h.store.userByEmail(SAM).tier).toBe("guide");
  });
});

describe("order_refunded", () => {
  it("marks the purchase refunded and drops a guide-only buyer to none", async () => {
    await send("order_created");
    await send("order_refunded");

    expect(h.store.purchases[0].status).toBe("refunded");
    expect(h.store.userByEmail(JANE).tier).toBe("none");
  });

  it("leaves the tier alone while an active subscription still covers the member", async () => {
    await send("order_created");
    // Jane also subscribes; the subscription fixture uses Sam's email, so
    // point it at Jane to model one person holding both.
    const created = fixture("subscription_created");
    (created.data.attributes as Record<string, unknown>).user_email = JANE;
    await processWebhook(created, h.deps);

    await send("order_refunded");

    expect(h.store.purchases[0].status).toBe("refunded");
    expect(h.store.userByEmail(JANE).tier).toBe("insider");
  });
});

describe("idempotency", () => {
  const everyFixture = [
    "order_created",
    "subscription_created",
    "subscription_payment_success",
    "subscription_cancelled",
    "subscription_resumed",
    "subscription_unpaused",
    "subscription_expired",
    "order_refunded",
  ];

  it("treats a byte-identical redelivery of every fixture as a duplicate", async () => {
    for (const name of everyFixture) {
      const first = await processWebhook(fixture(name), h.deps);
      expect(first.status, `${name} first delivery`).toBe("processed");

      const second = await processWebhook(fixture(name), h.deps);
      expect(second.status, `${name} redelivery`).toBe("duplicate");
    }

    expect(h.store.events).toHaveLength(everyFixture.length);
    expect(h.store.purchases).toHaveLength(1);
    expect(h.store.subscriptions).toHaveLength(1);
  });

  it("replaying the whole sequence twice does not flap the final tier", async () => {
    for (const name of everyFixture) await processWebhook(fixture(name), h.deps);
    const afterFirstPass = { ...h.store.userByEmail(SAM) };

    for (const name of everyFixture) await processWebhook(fixture(name), h.deps);

    expect(h.store.userByEmail(SAM)).toEqual(afterFirstPass);
  });
});

describe("grace period", () => {
  it("is TIER_GRACE_DAYS = 3 days past renews_at", () => {
    expect(TIER_GRACE_DAYS).toBe(3);
  });
});
