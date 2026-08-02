import { describe, it, expect, beforeEach } from "vitest";
import { processWebhook, replayWebhookEvent } from "@/lib/webhook/handlers";
import { countByStatus, toWebhookEventSummary, webhookEventStatus } from "@/lib/webhook/admin";
import { apiFixture, fixture, harness, plusGraceDays, type TestHarness } from "./support/memory-store";

const SAM = "sam.insider@example.com";
const SUB_AFTER_SIGNUP = fixture("subscription_created").data;
const SUB_AFTER_MONTH2 = apiFixture("subscription_2001_after_month2_renewal").data;

let h: TestHarness;

beforeEach(() => {
  h = harness();
  h.subscriptionApi.set("2001", SUB_AFTER_SIGNUP);
});

describe("replayWebhookEvent", () => {
  it("applies an event that failed the first time, once the cause is fixed", async () => {
    await processWebhook(fixture("subscription_created"), h.deps);

    // The renewal arrives while the Lemon Squeezy API is unreachable.
    h.subscriptionApi.clear();
    const failed = await processWebhook(fixture("subscription_payment_success_month2"), h.deps);
    expect(failed.status).toBe("failed");

    const row = h.store.events.at(-1)!;
    expect(webhookEventStatus(row)).toBe("failed");
    expect(h.store.userByEmail(SAM).tierExpiresAt).toEqual(plusGraceDays("2026-08-17T00:00:00.000000Z"));

    // API recovers; an admin presses replay.
    h.subscriptionApi.set("2001", SUB_AFTER_MONTH2);
    const replayed = await replayWebhookEvent(row.id, h.deps);

    expect(replayed.status).toBe("processed");
    expect(h.store.userByEmail(SAM).tierExpiresAt).toEqual(plusGraceDays("2026-09-17T00:00:00.000000Z"));
    expect(webhookEventStatus(h.store.events.at(-1)!)).toBe("processed");
  });

  it("clears the error once the replay succeeds", async () => {
    h.subscriptionApi.clear();
    await processWebhook(fixture("subscription_created"), h.deps);
    await processWebhook(fixture("subscription_payment_success"), h.deps);

    const row = h.store.events.at(-1)!;
    expect(row.error).toBeTruthy();

    h.subscriptionApi.set("2001", SUB_AFTER_SIGNUP);
    await replayWebhookEvent(row.id, h.deps);

    expect(h.store.events.at(-1)!.error).toBeNull();
  });

  it("is safe to press twice — no duplicate rows, same final state", async () => {
    await processWebhook(fixture("order_created"), h.deps);
    await processWebhook(fixture("subscription_created"), h.deps);
    const before = h.store.users.map((u) => ({ ...u }));

    for (const row of [...h.store.events]) await replayWebhookEvent(row.id, h.deps);
    for (const row of [...h.store.events]) await replayWebhookEvent(row.id, h.deps);

    expect(h.store.users).toEqual(before);
    expect(h.store.purchases).toHaveLength(1);
    expect(h.store.subscriptions).toHaveLength(1);
    expect(h.store.events).toHaveLength(2);
  });

  it("records the error again rather than throwing when the replay also fails", async () => {
    await processWebhook(fixture("subscription_created"), h.deps);
    h.subscriptionApi.clear();
    await processWebhook(fixture("subscription_payment_success"), h.deps);

    const row = h.store.events.at(-1)!;
    const result = await replayWebhookEvent(row.id, h.deps);

    expect(result.status).toBe("failed");
    expect(h.store.events.at(-1)!.error).toBeTruthy();
  });

  it("throws for an id that is not in webhook_events", async () => {
    await expect(replayWebhookEvent(9999, h.deps)).rejects.toThrow(/9999/);
  });
});

describe("admin webhook listing", () => {
  it("derives processed / failed / pending from the row", () => {
    expect(webhookEventStatus({ error: null, processedAt: new Date() })).toBe("processed");
    expect(webhookEventStatus({ error: "boom", processedAt: null })).toBe("failed");
    expect(webhookEventStatus({ error: null, processedAt: null })).toBe("pending");
    // An error wins even if an older run had marked it processed.
    expect(webhookEventStatus({ error: "boom", processedAt: new Date() })).toBe("failed");
  });

  it("lists most-recent-first and counts by status", async () => {
    await processWebhook(fixture("order_created"), h.deps);
    await processWebhook(fixture("subscription_created"), h.deps);
    h.subscriptionApi.clear();
    await processWebhook(fixture("subscription_payment_success"), h.deps);

    const rows = await h.store.listRecentWebhookEvents(10);
    const summaries = rows.map(toWebhookEventSummary);

    expect(summaries[0].eventName).toBe("subscription_payment_success");
    expect(summaries.at(-1)!.eventName).toBe("order_created");
    expect(countByStatus(summaries)).toEqual({ processed: 2, failed: 1, pending: 0 });
  });

  it("honours the limit", async () => {
    for (const name of ["order_created", "subscription_created", "subscription_cancelled"]) {
      await processWebhook(fixture(name), h.deps);
    }
    expect(await h.store.listRecentWebhookEvents(2)).toHaveLength(2);
  });
});
