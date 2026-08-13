import { describe, it, expect, afterEach, vi } from "vitest";
import { trackServerEvent } from "./analytics";

/**
 * QA-07-F11 (docs/qa-report-phase7.md). The Lemon Squeezy webhook handler
 * awaits this call, so a Plausible outage that hangs the connection rather than
 * refusing it used to hold the webhook open until Lemon Squeezy timed out and
 * retried — an analytics blip turning into a customer waiting for access.
 */
describe("trackServerEvent", () => {
  const original = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
    else process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = original;
    vi.unstubAllGlobals();
  });

  it("sends nothing at all when no Plausible domain is configured", async () => {
    delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await trackServerEvent("Purchase completed", { productKey: "guide" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("attaches an abort signal so a hung Plausible cannot stall the webhook", async () => {
    process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = "example.test";
    const fetchMock = vi.fn(
      async (url: string, init: RequestInit) => new Response(JSON.stringify({ url, init }), { status: 202 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await trackServerEvent("Purchase completed", { productKey: "guide" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]![1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("swallows a transport failure rather than failing its caller", async () => {
    process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = "example.test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await expect(trackServerEvent("Purchase completed")).resolves.toBeUndefined();
  });
});
