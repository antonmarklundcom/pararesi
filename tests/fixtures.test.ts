import { readdirSync } from "fs";
import { describe, it, expect } from "vitest";
import { fixture, apiFixture } from "./support/memory-store";

const WEBHOOK_FIXTURES = readdirSync("fixtures")
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

/**
 * Guards defect B2: the fixtures used to encode `"type": "subscriptions"` with
 * no `updated_at`, which made a replay test pass against a handler that drops
 * every renewal. These assertions keep the fixtures honest about the shapes
 * documented in the official Lemon Squeezy SDK types (@lemonsqueezy/lemonsqueezy.js).
 */
describe("webhook fixtures", () => {
  it("has one fixture per handled event, plus the month-2 renewal", () => {
    expect(WEBHOOK_FIXTURES.sort()).toEqual([
      "order_created",
      "order_refunded",
      "subscription_cancelled",
      "subscription_created",
      "subscription_expired",
      "subscription_payment_success",
      "subscription_payment_success_month2",
      "subscription_resumed",
      "subscription_unpaused",
    ]);
  });

  it.each(WEBHOOK_FIXTURES)("%s carries meta.event_name and data.attributes.updated_at", (name) => {
    const payload = fixture(name);
    expect(payload.meta.event_name).toBeTruthy();
    expect(payload.data.id).toBeTruthy();
    expect(payload.data.attributes.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("delivers subscription_payment_success as a subscription-invoices object", () => {
    for (const name of ["subscription_payment_success", "subscription_payment_success_month2"]) {
      const payload = fixture(name);
      expect(payload.data.type).toBe("subscription-invoices");
      expect(payload.data.attributes.subscription_id).toBe(2001);
      // The invoice object has no subscription dates — that is the whole
      // reason the handler has to fetch the subscription.
      expect(payload.data.attributes.renews_at).toBeUndefined();
      expect(payload.data.attributes.ends_at).toBeUndefined();
    }
  });

  it("gives the two payment_success invoices different ids and updated_at stamps", () => {
    const m1 = fixture("subscription_payment_success").data;
    const m2 = fixture("subscription_payment_success_month2").data;

    expect(m1.id).not.toBe(m2.id);
    expect(m1.attributes.updated_at).not.toBe(m2.attributes.updated_at);
    expect(m1.attributes.billing_reason).toBe("initial");
    expect(m2.attributes.billing_reason).toBe("renewal");
  });

  it("delivers subscription lifecycle events as subscriptions objects with renews_at", () => {
    for (const name of [
      "subscription_created",
      "subscription_cancelled",
      "subscription_resumed",
      "subscription_unpaused",
      "subscription_expired",
    ]) {
      const payload = fixture(name);
      expect(payload.data.type, name).toBe("subscriptions");
      expect(payload.data.id, name).toBe("2001");
      expect(payload.data.attributes.renews_at, name).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("delivers order events as orders objects with first_order_item", () => {
    for (const name of ["order_created", "order_refunded"]) {
      const payload = fixture(name);
      expect(payload.data.type, name).toBe("orders");
      expect(payload.data.attributes.first_order_item).toMatchObject({
        product_id: expect.any(Number),
        variant_id: expect.any(Number),
      });
      expect(payload.data.attributes.total).toEqual(expect.any(Number));
    }
  });

  it("marks order_refunded as refunded", () => {
    const attrs = fixture("order_refunded").data.attributes;
    expect(attrs.status).toBe("refunded");
    expect(attrs.refunded).toBe(true);
    expect(attrs.refunded_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("has an API fixture for the subscription as it stands after the month-2 renewal", () => {
    const resource = apiFixture("subscription_2001_after_month2_renewal").data;
    expect(resource.type).toBe("subscriptions");
    expect(resource.id).toBe("2001");
    expect(resource.attributes.renews_at).toBe("2026-09-17T00:00:00.000000Z");
  });
});
