import { describe, it, expect, beforeEach } from "vitest";
import { processWebhook } from "@/lib/webhook/handlers";
import { fixture, harness, plusGraceDays, type TestHarness } from "./support/memory-store";

const JANE = "jane.buyer@example.com";
const SAM = "sam.insider@example.com";

let h: TestHarness;

beforeEach(() => {
  h = harness();
  h.subscriptionApi.set("2001", fixture("subscription_created").data);
});

/** order_created with the checkout's custom_data stripped, as a raw LS order. */
function orderWithoutCustomData(variantId: number) {
  const payload = fixture("order_created");
  delete payload.meta.custom_data;
  (payload.data.attributes.first_order_item as Record<string, unknown>).variant_id = variantId;
  return payload;
}

describe("handleOrderCreated variant mapping", () => {
  it("throws rather than silently selling the guide when the variant maps to nothing", async () => {
    // 9999 is in no LS_VARIANT_* mapping — the misconfigured-env-var case.
    const result = await processWebhook(orderWithoutCustomData(9999), h.deps);

    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.error.message).toMatch(/9999/);
    expect(result.status === "failed" && result.error.message).toMatch(/LS_VARIANT_/);

    // Nothing was granted on the strength of a guess.
    expect(h.store.purchases).toHaveLength(0);
    expect(h.store.userByEmail(JANE).tier).toBe("none");
  });

  it("does not downgrade an insider order to guide when the mapping is missing", async () => {
    // The regression this guards: variant 9201 is insider-monthly. If its env
    // var were unset, the old fallback recorded it as a "guide" purchase.
    const result = await processWebhook(
      orderWithoutCustomData(9201),
      harness({
        ...h.deps,
        productKeyForVariantId: () => null, // simulate LS_VARIANT_* unset
      }).deps,
    );

    expect(result.status).toBe("failed");
  });

  it("still maps a variant id when custom_data is absent but the env mapping is right", async () => {
    const result = await processWebhook(orderWithoutCustomData(9101), h.deps);

    expect(result.status).toBe("processed");
    expect(h.store.purchases[0].productKey).toBe("guide");
  });
});

describe("handleOrderRefunded entitlement", () => {
  it("drops a guide-only buyer to none", async () => {
    await processWebhook(fixture("order_created"), h.deps);
    await processWebhook(fixture("order_refunded"), h.deps);

    expect(h.store.userByEmail(JANE).tier).toBe("none");
  });

  it("acts even when the tier has drifted away from guide", async () => {
    await processWebhook(fixture("order_created"), h.deps);

    // Tier hand-edited in /admin/users, or left over from a lapsed
    // subscription. The old `user.tier !== "guide"` guard made this a no-op.
    const jane = h.store.userByEmail(JANE);
    await h.store.updateUser(jane.id, { tier: "insider", tierExpiresAt: new Date("2026-12-01T00:00:00Z") });

    await processWebhook(fixture("order_refunded"), h.deps);

    expect(h.store.userByEmail(JANE).tier).toBe("none");
    expect(h.store.userByEmail(JANE).tierExpiresAt).toBeNull();
  });

  it("leaves insider alone while an active subscription still covers the member", async () => {
    await processWebhook(fixture("order_created"), h.deps);
    const created = fixture("subscription_created");
    (created.data.attributes as Record<string, unknown>).user_email = JANE;
    await processWebhook(created, h.deps);

    await processWebhook(fixture("order_refunded"), h.deps);

    expect(h.store.userByEmail(JANE).tier).toBe("insider");
  });

  it("never raises a tier", async () => {
    await processWebhook(fixture("order_created"), h.deps);
    const jane = h.store.userByEmail(JANE);
    await h.store.updateUser(jane.id, { tier: "none" });

    await processWebhook(fixture("order_refunded"), h.deps);

    expect(h.store.userByEmail(JANE).tier).toBe("none");
  });
});

describe("refunded purchases stop counting as entitlement", () => {
  it("does not fall back to guide after expiry when the guide order was refunded", async () => {
    // Same person: buys the guide, subscribes, refunds the guide, then the
    // subscription expires. The refunded guide must not resurrect guide access.
    const order = fixture("order_created");
    (order.data.attributes as Record<string, unknown>).user_email = SAM;
    await processWebhook(order, h.deps);
    await processWebhook(fixture("subscription_created"), h.deps);

    const refund = fixture("order_refunded");
    (refund.data.attributes as Record<string, unknown>).user_email = SAM;
    await processWebhook(refund, h.deps);
    expect(h.store.purchases[0].status).toBe("refunded");

    await processWebhook(fixture("subscription_expired"), h.deps);

    expect(h.store.userByEmail(SAM).tier).toBe("none");
  });

  it("still falls back to guide when the guide order stands", async () => {
    const order = fixture("order_created");
    (order.data.attributes as Record<string, unknown>).user_email = SAM;
    await processWebhook(order, h.deps);
    await processWebhook(fixture("subscription_created"), h.deps);

    await processWebhook(fixture("subscription_expired"), h.deps);

    expect(h.store.userByEmail(SAM).tier).toBe("guide");
  });
});

/**
 * Findings from the phase 7 adversarial pass (docs/qa-report-phase7.md). Each
 * test below is named for the finding it pins down.
 */
describe("QA-07-F1: a subscription with no renews_at must not become lifetime insider", () => {
  /**
   * `tierExpiresAt: null` on an insider is not "expiry unknown", it is "never
   * expires" — resolveEffectiveTier only downgrades a member it has a date to
   * compare against. Lemon Squeezy reports renews_at as null on a subscription
   * that will not renew, and those payloads still reach handleSubscriptionActive
   * via subscription_resumed and subscription_payment_success.
   */
  it("falls back to ends_at when renews_at is null", async () => {
    await processWebhook(fixture("subscription_created"), h.deps);

    const resumed = fixture("subscription_resumed");
    const attrs = resumed.data.attributes as Record<string, unknown>;
    attrs.renews_at = null;
    attrs.ends_at = "2026-09-01T00:00:00.000000Z";

    await processWebhook(resumed, h.deps);

    const sam = h.store.userByEmail(SAM);
    expect(sam.tier).toBe("insider");
    expect(sam.tierExpiresAt).toEqual(plusGraceDays("2026-09-01T00:00:00.000000Z"));
  });

  it("keeps the existing paid-through date when the payload carries neither date", async () => {
    await processWebhook(fixture("subscription_created"), h.deps);
    const before = h.store.userByEmail(SAM).tierExpiresAt;
    expect(before).not.toBeNull();

    const resumed = fixture("subscription_resumed");
    const attrs = resumed.data.attributes as Record<string, unknown>;
    attrs.renews_at = null;
    attrs.ends_at = null;

    await processWebhook(resumed, h.deps);

    // Emphatically not null: null here would hand out unexpiring insider.
    expect(h.store.userByEmail(SAM).tierExpiresAt).toEqual(before);
  });
});

describe("QA-07-F3: expiry of one subscription must not revoke another", () => {
  it("keeps insider when a second subscription is still active", async () => {
    await processWebhook(fixture("subscription_created"), h.deps);
    const sam = h.store.userByEmail(SAM);

    // The member resubscribed, so a second row exists and is active. (The same
    // shape arises when someone else's checkout is attributed to this account
    // through checkout custom_data.)
    await h.store.createSubscription({
      userId: sam.id,
      lsSubscriptionId: "2002",
      status: "active",
      renewsAt: new Date("2026-12-01T00:00:00.000Z"),
      endsAt: null,
    });

    await processWebhook(fixture("subscription_expired"), h.deps);

    const after = h.store.userByEmail(SAM);
    expect(after.tier).toBe("insider");
    // Re-anchored to the surviving subscription rather than left on the dead
    // one's date, which would expire them within the grace window.
    expect(after.tierExpiresAt).toEqual(plusGraceDays("2026-12-01T00:00:00.000Z"));
  });

  it("still downgrades when the expiring subscription was the only one", async () => {
    await processWebhook(fixture("subscription_created"), h.deps);

    await processWebhook(fixture("subscription_expired"), h.deps);

    const after = h.store.userByEmail(SAM);
    expect(after.tier).toBe("none");
    expect(after.tierExpiresAt).toBeNull();
  });
});

describe("QA-07-F5: a lost race to log the event is a duplicate, not a failure", () => {
  /**
   * findWebhookEventByLsId-then-insert is not atomic, and Lemon Squeezy can
   * have two deliveries of one event in flight. The unique index rejects the
   * loser; that used to escape processWebhook as an unhandled throw, so the
   * winning delivery applied the event and the loser reported a 500 — inviting
   * Lemon Squeezy to retry an event that had already been processed.
   */
  it("reports duplicate when the insert loses to a concurrent delivery", async () => {
    const payload = fixture("order_created");
    const store = h.store;
    let raced = false;
    const realCreate = store.createWebhookEvent.bind(store);

    store.createWebhookEvent = async (input) => {
      if (!raced) {
        raced = true;
        // The concurrent delivery landing between the lookup and this insert.
        await realCreate(input);
      }
      return realCreate(input);
    };

    const result = await processWebhook(payload, h.deps);

    expect(result.status).toBe("duplicate");
    expect(store.events).toHaveLength(1);
  });
});
