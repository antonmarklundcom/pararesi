import { describe, it, expect } from "vitest";
import {
  summarizeAdminMetrics,
  formatUsdFromCents,
  RECENT_WINDOW_DAYS,
  type AdminMetricsInput,
  type MetricsUserInput,
} from "./admin-metrics";

const NOW = new Date("2026-08-20T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

function inDays(days: number): Date {
  return new Date(NOW.getTime() + days * DAY_MS);
}

function member(overrides: Partial<MetricsUserInput> = {}): MetricsUserInput {
  return {
    role: "member",
    tier: "guide",
    tierExpiresAt: null,
    hasPassword: true,
    hasGuidePurchase: true,
    createdAt: daysAgo(60),
    ...overrides,
  };
}

function input(overrides: Partial<AdminMetricsInput> = {}): AdminMetricsInput {
  return {
    usersList: [],
    purchasesList: [],
    subscriptionsList: [],
    leadsList: [],
    webhookStatuses: [],
    ...overrides,
  };
}

describe("summarizeAdminMetrics — members", () => {
  it("counts members by the tier they actually have right now, not the stored one", () => {
    const metrics = summarizeAdminMetrics(
      input({
        usersList: [
          member({ tier: "insider", tierExpiresAt: inDays(10) }),
          member({ tier: "insider", tierExpiresAt: daysAgo(1), hasGuidePurchase: true }),
          member({ tier: "insider", tierExpiresAt: daysAgo(1), hasGuidePurchase: false }),
          member({ tier: "guide" }),
        ],
      }),
      NOW,
    );

    expect(metrics.members.total).toBe(4);
    expect(metrics.members.insider).toBe(1);
    // The lapsed insider with a guide order falls back to guide; the one
    // without falls back to none and is in neither paid bucket.
    expect(metrics.members.guide).toBe(2);
    expect(metrics.members.lapsed).toBe(2);
  });

  it("excludes admins from the member counts", () => {
    const metrics = summarizeAdminMetrics(
      input({ usersList: [member({ role: "admin" }), member()] }),
      NOW,
    );

    expect(metrics.members.total).toBe(1);
  });

  it("flags paying accounts that never followed the set-password link", () => {
    const metrics = summarizeAdminMetrics(
      input({
        usersList: [
          member({ hasPassword: false }),
          // Refunded down to nothing — not someone waiting on an email.
          member({ hasPassword: false, tier: "none", hasGuidePurchase: false }),
          member({ hasPassword: true }),
        ],
      }),
      NOW,
    );

    expect(metrics.members.awaitingPassword).toBe(1);
  });

  it("counts signups inside the recent window, inclusive of its edge", () => {
    const metrics = summarizeAdminMetrics(
      input({
        usersList: [
          member({ createdAt: daysAgo(1) }),
          member({ createdAt: daysAgo(RECENT_WINDOW_DAYS) }),
          member({ createdAt: daysAgo(RECENT_WINDOW_DAYS + 1) }),
        ],
      }),
      NOW,
    );

    expect(metrics.members.newRecently).toBe(2);
  });
});

describe("summarizeAdminMetrics — revenue", () => {
  it("nets refunds out of gross and keeps them out of the recent window", () => {
    const metrics = summarizeAdminMetrics(
      input({
        purchasesList: [
          { amountCents: 700, status: "paid", createdAt: daysAgo(2) },
          { amountCents: 4700, status: "paid", createdAt: daysAgo(90) },
          { amountCents: 700, status: "refunded", createdAt: daysAgo(3) },
        ],
      }),
      NOW,
    );

    expect(metrics.revenue.grossCents).toBe(6100);
    expect(metrics.revenue.refundedCents).toBe(700);
    expect(metrics.revenue.netCents).toBe(5400);
    expect(metrics.revenue.recentNetCents).toBe(700);
    expect(metrics.revenue.orderCount).toBe(3);
    expect(metrics.revenue.refundedCount).toBe(1);
  });
});

describe("summarizeAdminMetrics — subscriptions", () => {
  it("treats past_due as still active, and counts it separately for dunning", () => {
    const metrics = summarizeAdminMetrics(
      input({
        subscriptionsList: [
          { status: "active" },
          { status: "on_trial" },
          { status: "past_due" },
          { status: "cancelled" },
          { status: "expired" },
        ],
      }),
      NOW,
    );

    expect(metrics.subscriptions.active).toBe(3);
    expect(metrics.subscriptions.pastDue).toBe(1);
    expect(metrics.subscriptions.ended).toBe(2);
  });
});

describe("summarizeAdminMetrics — leads", () => {
  it("splits the funnel and rates confirmation over every captured address", () => {
    const metrics = summarizeAdminMetrics(
      input({
        leadsList: [
          { confirmedAt: daysAgo(5), unsubscribedAt: null, createdAt: daysAgo(5) },
          { confirmedAt: daysAgo(40), unsubscribedAt: daysAgo(2), createdAt: daysAgo(40) },
          { confirmedAt: null, unsubscribedAt: null, createdAt: daysAgo(1) },
          { confirmedAt: null, unsubscribedAt: null, createdAt: daysAgo(100) },
        ],
      }),
      NOW,
    );

    expect(metrics.leads.total).toBe(4);
    expect(metrics.leads.confirmed).toBe(1);
    expect(metrics.leads.unsubscribed).toBe(1);
    expect(metrics.leads.pending).toBe(2);
    // An unsubscribed lead still confirmed once — the rate measures opt-in,
    // not current mailability.
    expect(metrics.leads.confirmRate).toBeCloseTo(0.5);
    expect(metrics.leads.newRecently).toBe(2);
  });

  it("reports a zero confirm rate rather than NaN on an empty list", () => {
    expect(summarizeAdminMetrics(input(), NOW).leads.confirmRate).toBe(0);
  });
});

describe("summarizeAdminMetrics — webhooks", () => {
  it("carries the failed and pending counts through", () => {
    const metrics = summarizeAdminMetrics(
      input({ webhookStatuses: ["processed", "processed", "failed", "pending"] }),
      NOW,
    );

    expect(metrics.webhooks).toEqual({ processed: 2, failed: 1, pending: 1 });
  });
});

describe("formatUsdFromCents", () => {
  it("renders cents as dollars with two decimals", () => {
    expect(formatUsdFromCents(0)).toBe("$0.00");
    expect(formatUsdFromCents(700)).toBe("$7.00");
    expect(formatUsdFromCents(123456)).toBe("$1,234.56");
  });
});
