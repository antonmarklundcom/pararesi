import { describe, it, expect } from "vitest";
import { TIER_RANK, resolveEffectiveTier } from "./tiers";
import { TIER_GRACE_DAYS } from "./webhook/types";

const RENEWS_AT = new Date("2026-08-17T00:00:00.000Z");
const EXPIRES_AT = new Date(RENEWS_AT.getTime() + TIER_GRACE_DAYS * 24 * 60 * 60 * 1000);

describe("TIER_RANK", () => {
  it("orders none < guide < insider", () => {
    expect(TIER_RANK.none).toBeLessThan(TIER_RANK.guide);
    expect(TIER_RANK.guide).toBeLessThan(TIER_RANK.insider);
  });
});

describe("resolveEffectiveTier grace-period boundaries", () => {
  const at = (now: Date, hasGuidePurchase = false) =>
    resolveEffectiveTier({ tier: "insider", tierExpiresAt: EXPIRES_AT, now, hasGuidePurchase });

  it("grants 3 days past renews_at", () => {
    expect(EXPIRES_AT.toISOString()).toBe("2026-08-20T00:00:00.000Z");
  });

  it("keeps insider the day before expiry", () => {
    expect(at(new Date("2026-08-19T23:59:59.999Z"))).toBe("insider");
  });

  it("keeps insider at exactly tierExpiresAt (the boundary is inclusive)", () => {
    expect(at(new Date(EXPIRES_AT))).toBe("insider");
  });

  it("keeps insider on the last millisecond before the deadline", () => {
    expect(at(new Date(EXPIRES_AT.getTime() - 1))).toBe("insider");
  });

  it("downgrades one millisecond after tierExpiresAt", () => {
    expect(at(new Date(EXPIRES_AT.getTime() + 1))).toBe("none");
  });

  it("still grants insider inside the grace window, after renews_at has passed", () => {
    expect(at(new Date("2026-08-18T12:00:00.000Z"))).toBe("insider");
  });

  it("falls back to guide after expiry when the member also bought the guide", () => {
    expect(at(new Date(EXPIRES_AT.getTime() + 1), true)).toBe("guide");
  });
});

describe("resolveEffectiveTier for non-expiring tiers", () => {
  it("leaves guide alone regardless of tierExpiresAt", () => {
    expect(
      resolveEffectiveTier({
        tier: "guide",
        tierExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
        now: new Date("2026-08-17T00:00:00.000Z"),
        hasGuidePurchase: true,
      }),
    ).toBe("guide");
  });

  it("leaves insider alone when tierExpiresAt is null (never set)", () => {
    expect(
      resolveEffectiveTier({
        tier: "insider",
        tierExpiresAt: null,
        now: new Date("2099-01-01T00:00:00.000Z"),
        hasGuidePurchase: false,
      }),
    ).toBe("insider");
  });

  it("leaves none alone", () => {
    expect(
      resolveEffectiveTier({
        tier: "none",
        tierExpiresAt: null,
        now: new Date(),
        hasGuidePurchase: false,
      }),
    ).toBe("none");
  });
});
