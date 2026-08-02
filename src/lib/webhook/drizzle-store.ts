import { eq, and, desc, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { webhookEvents, users, purchases, subscriptions } from "@/db/schema";
import type { Tier } from "@/lib/tiers";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  type PurchaseRecord,
  type SubscriptionRecord,
  type UserRecord,
  type WebhookEventRecord,
  type WebhookStore,
} from "./types";

type UserRow = typeof users.$inferSelect;
type PurchaseRow = typeof purchases.$inferSelect;
type SubscriptionRow = typeof subscriptions.$inferSelect;
type WebhookEventRow = typeof webhookEvents.$inferSelect;

function toUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    tier: row.tier as Tier,
    tierExpiresAt: row.tierExpiresAt ?? null,
  };
}

function toPurchase(row: PurchaseRow): PurchaseRecord {
  return { id: row.id, userId: row.userId, lsOrderId: row.lsOrderId, productKey: row.productKey, status: row.status };
}

function toSubscription(row: SubscriptionRow): SubscriptionRecord {
  return {
    id: row.id,
    userId: row.userId,
    lsSubscriptionId: row.lsSubscriptionId,
    status: row.status,
    renewsAt: row.renewsAt ?? null,
    endsAt: row.endsAt ?? null,
  };
}

function toWebhookEvent(row: WebhookEventRow): WebhookEventRecord {
  return {
    id: row.id,
    lsEventId: row.lsEventId,
    eventName: row.eventName,
    processedAt: row.processedAt ?? null,
    error: row.error ?? null,
    createdAt: row.createdAt,
  };
}

/** The production WebhookStore: the same drizzle queries the route used inline. */
export const drizzleWebhookStore: WebhookStore = {
  async findUserById(id) {
    const [row] = await db.select().from(users).where(eq(users.id, id));
    return row ? toUser(row) : null;
  },

  async findUserByEmail(email) {
    const [row] = await db.select().from(users).where(eq(users.email, email));
    return row ? toUser(row) : null;
  },

  async createUser({ email, name }) {
    const [inserted] = await db
      .insert(users)
      .values({ email, name: name ?? undefined, role: "member", tier: "none" })
      .$returningId();
    const [row] = await db.select().from(users).where(eq(users.id, inserted.id));
    return toUser(row!);
  },

  async updateUser(id, patch) {
    await db.update(users).set(patch).where(eq(users.id, id));
  },

  async findPurchaseByOrderId(lsOrderId) {
    const [row] = await db.select().from(purchases).where(eq(purchases.lsOrderId, lsOrderId));
    return row ? toPurchase(row) : null;
  },

  async findGuidePurchase(userId) {
    const [row] = await db
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.userId, userId),
          eq(purchases.productKey, "guide"),
          ne(purchases.status, "refunded"),
        ),
      );
    return row ? toPurchase(row) : null;
  },

  async createPurchase(input) {
    await db.insert(purchases).values(input);
  },

  async updatePurchaseStatus(id, status) {
    await db.update(purchases).set({ status }).where(eq(purchases.id, id));
  },

  async findSubscriptionByLsId(lsSubscriptionId) {
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.lsSubscriptionId, lsSubscriptionId));
    return row ? toSubscription(row) : null;
  },

  async findActiveSubscriptionForUser(userId) {
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), inArray(subscriptions.status, ACTIVE_SUBSCRIPTION_STATUSES)));
    return row ? toSubscription(row) : null;
  },

  async createSubscription(input) {
    await db.insert(subscriptions).values(input);
  },

  async updateSubscription(id, patch) {
    await db.update(subscriptions).set(patch).where(eq(subscriptions.id, id));
  },

  async findWebhookEventByLsId(lsEventId) {
    const [row] = await db.select().from(webhookEvents).where(eq(webhookEvents.lsEventId, lsEventId));
    return row ? toWebhookEvent(row) : null;
  },

  async findWebhookEventById(id) {
    const [row] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, id));
    return row ? { ...toWebhookEvent(row), raw: row.raw } : null;
  },

  async listRecentWebhookEvents(limit) {
    const rows = await db.select().from(webhookEvents).orderBy(desc(webhookEvents.id)).limit(limit);
    return rows.map(toWebhookEvent);
  },

  async createWebhookEvent({ lsEventId, eventName, raw }) {
    const [inserted] = await db.insert(webhookEvents).values({ lsEventId, eventName, raw }).$returningId();
    return inserted.id;
  },

  async markWebhookEventProcessed(id) {
    await db.update(webhookEvents).set({ processedAt: new Date(), error: null }).where(eq(webhookEvents.id, id));
  },

  async markWebhookEventError(id, error) {
    await db.update(webhookEvents).set({ error }).where(eq(webhookEvents.id, id));
  },
};
