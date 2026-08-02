import crypto from "crypto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { harness, fixture, type TestHarness } from "./support/memory-store";

const SECRET = "test-webhook-secret";

let h: TestHarness;

// The route builds its dependencies from the environment; point that at the
// in-memory harness so the HTTP contract can be tested without a database.
vi.mock("@/lib/webhook/deps", () => ({
  productionWebhookDeps: () => h.deps,
}));

const { POST } = await import("@/app/api/webhooks/lemonsqueezy/route");

function request(payload: unknown, { sign = true } = {}) {
  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", sign ? SECRET : "wrong-secret")
    .update(body)
    .digest("hex");

  return new Request("https://example.test/api/webhooks/lemonsqueezy", {
    method: "POST",
    headers: { "content-type": "application/json", "x-signature": signature },
    body,
  });
}

beforeEach(() => {
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = SECRET;
  h = harness();
  h.subscriptionApi.set("2001", fixture("subscription_created").data);
});

describe("POST /api/webhooks/lemonsqueezy status codes", () => {
  it("401s an unsigned request without recording anything", async () => {
    const res = await POST(
      new Request("https://example.test/api/webhooks/lemonsqueezy", {
        method: "POST",
        body: JSON.stringify(fixture("order_created")),
      }),
    );

    expect(res.status).toBe(401);
    expect(h.store.events).toHaveLength(0);
  });

  it("401s a wrongly signed request", async () => {
    const res = await POST(request(fixture("order_created"), { sign: false }));
    expect(res.status).toBe(401);
    expect(h.store.events).toHaveLength(0);
  });

  it("400s a signed body that is not JSON", async () => {
    const body = "not json";
    const signature = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
    const res = await POST(
      new Request("https://example.test/api/webhooks/lemonsqueezy", {
        method: "POST",
        headers: { "x-signature": signature },
        body,
      }),
    );

    expect(res.status).toBe(400);
  });

  it("200s a successfully handled event", async () => {
    const res = await POST(request(fixture("order_created")));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("200s a genuine duplicate rather than asking for a retry", async () => {
    await POST(request(fixture("order_created")));
    const res = await POST(request(fixture("order_created")));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, duplicate: true });
  });

  it("500s a handler failure so Lemon Squeezy retries (B3)", async () => {
    await POST(request(fixture("subscription_created")));
    h.subscriptionApi.clear(); // the API call inside the renewal handler will fail

    const res = await POST(request(fixture("subscription_payment_success")));

    expect(res.status).toBe(500);
    expect(h.store.events.at(-1)?.error).toBeTruthy();
    expect(h.store.events.at(-1)?.processedAt).toBeNull();
  });

  it("401s when no webhook secret is configured at all", async () => {
    delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    const res = await POST(request(fixture("order_created")));
    expect(res.status).toBe(401);
  });
});
