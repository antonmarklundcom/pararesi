import { describe, it, expect, beforeEach } from "vitest";
import { processWebhook } from "@/lib/webhook/handlers";
import { fixture, harness, type TestHarness } from "./support/memory-store";

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
