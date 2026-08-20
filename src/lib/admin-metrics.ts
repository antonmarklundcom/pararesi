/**
 * The numbers the owner needs on the /admin landing page: who is paying, what
 * the funnel looks like, and whether anything on the money path is stuck.
 *
 * Split the way the rest of the money logic is — a pure summarizer that the
 * tests drive with plain objects, and a thin loader that reads the database.
 */

import { db } from "@/db";
import { users, purchases, subscriptions, leads } from "@/db/schema";
import { resolveEffectiveTier, type Tier } from "@/lib/tiers";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/lib/webhook/types";
import { listRecentWebhookEvents, countByStatus, type WebhookEventStatus } from "@/lib/webhook/admin";

/** The rolling window every "recent" number on the dashboard is measured over. */
export const RECENT_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface MetricsUserInput {
  role: "admin" | "member";
  tier: Tier;
  tierExpiresAt: Date | null;
  /** False while a paying customer has never followed their set-password link. */
  hasPassword: boolean;
  /** A non-refunded `guide` order, i.e. what a lapsed insider falls back to. */
  hasGuidePurchase: boolean;
  createdAt: Date;
}

export interface MetricsPurchaseInput {
  /** Cents, as Lemon Squeezy's `total` is stored (see purchases.amountUsd). */
  amountCents: number;
  status: string;
  createdAt: Date;
}

export interface MetricsSubscriptionInput {
  status: string;
}

export interface MetricsLeadInput {
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
  createdAt: Date;
}

export interface AdminMetricsInput {
  usersList: MetricsUserInput[];
  purchasesList: MetricsPurchaseInput[];
  subscriptionsList: MetricsSubscriptionInput[];
  leadsList: MetricsLeadInput[];
  webhookStatuses: WebhookEventStatus[];
}

export interface AdminMetrics {
  members: {
    total: number;
    guide: number;
    insider: number;
    /** Stored tier is insider, but the paid-through date has passed. */
    lapsed: number;
    /** Paid, account created by the webhook, password never set. */
    awaitingPassword: number;
    newRecently: number;
  };
  revenue: {
    /** Every recorded order, refunds included. */
    grossCents: number;
    refundedCents: number;
    netCents: number;
    recentNetCents: number;
    orderCount: number;
    refundedCount: number;
  };
  subscriptions: {
    active: number;
    pastDue: number;
    ended: number;
  };
  leads: {
    total: number;
    pending: number;
    /** Confirmed and not unsubscribed — the only rows that may be mailed. */
    confirmed: number;
    unsubscribed: number;
    /** Share of all captured addresses that completed double opt-in, 0–1. */
    confirmRate: number;
    newRecently: number;
  };
  webhooks: Record<WebhookEventStatus, number>;
}

function isRecent(date: Date, now: Date): boolean {
  return now.getTime() - date.getTime() <= RECENT_WINDOW_DAYS * DAY_MS;
}

export function summarizeAdminMetrics(input: AdminMetricsInput, now: Date): AdminMetrics {
  const members = input.usersList.filter((user) => user.role === "member");

  let guide = 0;
  let insider = 0;
  let lapsed = 0;
  let awaitingPassword = 0;
  let newMembers = 0;

  for (const user of members) {
    const effective = resolveEffectiveTier({
      tier: user.tier,
      tierExpiresAt: user.tierExpiresAt,
      now,
      hasGuidePurchase: user.hasGuidePurchase,
    });

    if (effective === "insider") insider += 1;
    if (effective === "guide") guide += 1;
    // Counted off the stored tier, not the effective one: this is "someone we
    // billed as an insider whose access has run out", which is what a churn
    // number has to be, and it stays true whether they fall back to guide or
    // to nothing at all.
    if (user.tier === "insider" && effective !== "insider") lapsed += 1;
    // Only paying accounts can be stuck here — a tier of "none" is a user the
    // webhook created and then refunded, not someone waiting on an email.
    if (!user.hasPassword && effective !== "none") awaitingPassword += 1;
    if (isRecent(user.createdAt, now)) newMembers += 1;
  }

  let grossCents = 0;
  let refundedCents = 0;
  let recentNetCents = 0;
  let refundedCount = 0;

  for (const purchase of input.purchasesList) {
    const refunded = purchase.status === "refunded";
    grossCents += purchase.amountCents;
    if (refunded) {
      refundedCents += purchase.amountCents;
      refundedCount += 1;
    }
    if (!refunded && isRecent(purchase.createdAt, now)) recentNetCents += purchase.amountCents;
  }

  const activeStatuses = new Set(ACTIVE_SUBSCRIPTION_STATUSES);
  let active = 0;
  let pastDue = 0;
  let ended = 0;

  for (const subscription of input.subscriptionsList) {
    if (subscription.status === "past_due") pastDue += 1;
    if (activeStatuses.has(subscription.status)) active += 1;
    else ended += 1;
  }

  let pending = 0;
  let confirmed = 0;
  let unsubscribed = 0;
  let newLeads = 0;

  for (const lead of input.leadsList) {
    if (lead.unsubscribedAt) unsubscribed += 1;
    else if (lead.confirmedAt) confirmed += 1;
    else pending += 1;
    if (isRecent(lead.createdAt, now)) newLeads += 1;
  }

  const everConfirmed = input.leadsList.filter((lead) => lead.confirmedAt !== null).length;

  const webhooks = countByStatus(input.webhookStatuses.map((status) => ({ status })));

  return {
    members: {
      total: members.length,
      guide,
      insider,
      lapsed,
      awaitingPassword,
      newRecently: newMembers,
    },
    revenue: {
      grossCents,
      refundedCents,
      netCents: grossCents - refundedCents,
      recentNetCents,
      orderCount: input.purchasesList.length,
      refundedCount,
    },
    subscriptions: { active, pastDue, ended },
    leads: {
      total: input.leadsList.length,
      pending,
      confirmed,
      unsubscribed,
      confirmRate: input.leadsList.length === 0 ? 0 : everConfirmed / input.leadsList.length,
      newRecently: newLeads,
    },
    webhooks,
  };
}

export function formatUsdFromCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Admin-only. Reads the whole of four small tables: at this product's scale
 * they are hundreds of rows, and aggregating in JS keeps the effective-tier
 * rule in one place instead of restating it as SQL that could drift from
 * resolveEffectiveTier.
 */
export async function loadAdminMetrics(now: Date = new Date()): Promise<AdminMetrics> {
  const [userRows, purchaseRows, subscriptionRows, leadRows, webhookEvents] = await Promise.all([
    db
      .select({
        id: users.id,
        role: users.role,
        tier: users.tier,
        tierExpiresAt: users.tierExpiresAt,
        passwordHash: users.passwordHash,
        createdAt: users.createdAt,
      })
      .from(users),
    db
      .select({
        userId: purchases.userId,
        productKey: purchases.productKey,
        amountUsd: purchases.amountUsd,
        status: purchases.status,
        createdAt: purchases.createdAt,
      })
      .from(purchases),
    db.select({ status: subscriptions.status }).from(subscriptions),
    db
      .select({
        confirmedAt: leads.confirmedAt,
        unsubscribedAt: leads.unsubscribedAt,
        createdAt: leads.createdAt,
      })
      .from(leads),
    // Already requireAdmin-gated, and the same window the /admin/webhooks page shows.
    listRecentWebhookEvents(),
  ]);

  // Same rule as the webhook store's findGuidePurchase: a `guide` order that
  // has not been refunded is what a lapsed insider keeps access to.
  const guidePurchaserIds = new Set(
    purchaseRows
      .filter((row) => row.productKey === "guide" && row.status !== "refunded")
      .map((row) => row.userId),
  );

  return summarizeAdminMetrics(
    {
      usersList: userRows.map((row) => ({
        role: row.role,
        tier: row.tier,
        tierExpiresAt: row.tierExpiresAt,
        hasPassword: row.passwordHash !== null,
        hasGuidePurchase: guidePurchaserIds.has(row.id),
        createdAt: row.createdAt,
      })),
      purchasesList: purchaseRows.map((row) => ({
        amountCents: row.amountUsd,
        status: row.status,
        createdAt: row.createdAt,
      })),
      subscriptionsList: subscriptionRows.map((row) => ({ status: row.status })),
      leadsList: leadRows.map((row) => ({
        confirmedAt: row.confirmedAt,
        unsubscribedAt: row.unsubscribedAt,
        createdAt: row.createdAt,
      })),
      webhookStatuses: webhookEvents.map((event) => event.status),
    },
    now,
  );
}
