import type { LemonSqueezyPayload } from "@/lib/ls-webhook";
import type { Tier } from "@/lib/tiers";
import type { EmailTemplate } from "@/lib/email";

/**
 * Days of access granted past a subscription's paid-through date, so a member
 * isn't locked out by a renewal webhook that lands a few hours late or a
 * payment that takes a retry to clear.
 */
export const TIER_GRACE_DAYS = 3;

/** Subscription statuses that still count as "this member is paying us". */
export const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "on_trial", "past_due"];

// --- Records ---
//
// Deliberately narrower than the drizzle row types: only the columns the
// webhook handlers actually read. Keeping them small is what lets the tests
// run against an in-memory store instead of a MySQL instance.

export type UserRecord = {
  id: number;
  email: string;
  name: string | null;
  tier: Tier;
  tierExpiresAt: Date | null;
  /**
   * Whether the account can actually be logged into yet. A user row is created
   * by the first purchase webhook with no password at all, so a second purchase
   * has to be able to tell "existing customer" from "existing customer who
   * never followed the set-password link" — see handleOrderCreated.
   */
  hasPassword: boolean;
};

export type PurchaseRecord = {
  id: number;
  userId: number;
  lsOrderId: string;
  productKey: string;
  status: string;
};

export type SubscriptionRecord = {
  id: number;
  userId: number;
  lsSubscriptionId: string;
  status: string;
  renewsAt: Date | null;
  endsAt: Date | null;
};

export type WebhookEventRecord = {
  id: number;
  lsEventId: string;
  eventName: string;
  processedAt: Date | null;
  error: string | null;
  createdAt?: Date;
};

/**
 * Everything the handlers need from the database. The production
 * implementation is drizzle (see drizzle-store.ts); tests supply an in-memory
 * one so the whole state machine can be exercised without a database.
 */
export interface WebhookStore {
  findUserById(id: number): Promise<UserRecord | null>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  createUser(input: { email: string; name: string | null }): Promise<UserRecord>;
  updateUser(
    id: number,
    patch: Partial<{ tier: Tier; tierExpiresAt: Date | null; lsCustomerId: string }>,
  ): Promise<void>;

  findPurchaseByOrderId(lsOrderId: string): Promise<PurchaseRecord | null>;
  /**
   * The user's guide purchase, if they still hold one. Excludes refunded
   * purchases — a refunded guide must not keep granting guide access after a
   * subscription expires.
   */
  findGuidePurchase(userId: number): Promise<PurchaseRecord | null>;
  createPurchase(input: {
    userId: number;
    lsOrderId: string;
    lsProductId: string;
    lsVariantId: string;
    productKey: string;
    amountUsd: number;
    status: string;
    raw: unknown;
  }): Promise<void>;
  updatePurchaseStatus(id: number, status: string): Promise<void>;

  findSubscriptionByLsId(lsSubscriptionId: string): Promise<SubscriptionRecord | null>;
  findActiveSubscriptionForUser(userId: number): Promise<SubscriptionRecord | null>;
  createSubscription(input: {
    userId: number;
    lsSubscriptionId: string;
    status: string;
    renewsAt: Date | null;
    endsAt: Date | null;
    raw: unknown;
  }): Promise<void>;
  updateSubscription(
    id: number,
    patch: Partial<{ status: string; renewsAt: Date | null; endsAt: Date | null; raw: unknown }>,
  ): Promise<void>;

  findWebhookEventByLsId(lsEventId: string): Promise<WebhookEventRecord | null>;
  findWebhookEventById(id: number): Promise<(WebhookEventRecord & { raw: unknown }) | null>;
  /** Most recent first. Used by the admin webhook surface, not by the handlers. */
  listRecentWebhookEvents(limit: number): Promise<WebhookEventRecord[]>;
  createWebhookEvent(input: { lsEventId: string; eventName: string; raw: unknown }): Promise<number>;
  markWebhookEventProcessed(id: number): Promise<void>;
  markWebhookEventError(id: number, error: string): Promise<void>;
}

/**
 * The non-database side effects, injected for the same reason: tests assert on
 * what would have been sent rather than sending it.
 */
export interface WebhookDeps {
  store: WebhookStore;
  sendEmail(args: { to: string; template: EmailTemplate; data: Record<string, string> }): Promise<void>;
  createPasswordToken(userId: number, purpose: "set" | "reset"): Promise<string>;
  /** Maps an incoming variant_id back to our internal product key. */
  productKeyForVariantId(variantId: string | number): string | null;
  /**
   * Fetches a subscription's current attributes from the Lemon Squeezy API.
   * Needed because a `subscription-invoices` webhook payload carries no
   * renews_at — see handleSubscriptionPaymentSuccess.
   */
  fetchSubscription(lsSubscriptionId: string): Promise<LemonSqueezyPayload["data"]>;
  appUrl: string;
}
