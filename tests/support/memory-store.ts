import { readFileSync } from "fs";
import { join } from "path";
import type { LemonSqueezyPayload } from "@/lib/ls-webhook";
import type { Tier } from "@/lib/tiers";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  type PurchaseRecord,
  type SubscriptionRecord,
  type UserRecord,
  type WebhookDeps,
  type WebhookEventRecord,
  type WebhookStore,
} from "@/lib/webhook/types";

const FIXTURE_DIR = join(process.cwd(), "fixtures");

/** Loads a webhook fixture from /fixtures. */
export function fixture(name: string): LemonSqueezyPayload {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, `${name}.json`), "utf8"));
}

/** Loads an API-response fixture from /fixtures/api. */
export function apiFixture(name: string): { data: LemonSqueezyPayload["data"] } {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, "api", `${name}.json`), "utf8"));
}

export type SentEmail = { to: string; template: string; data: Record<string, string> };

/**
 * In-memory WebhookStore. Same semantics as the drizzle one for the queries
 * the handlers make — including the unique index on webhook_events.ls_event_id,
 * which is what the idempotency behaviour depends on.
 */
export class MemoryStore implements WebhookStore {
  users: UserRecord[] = [];
  purchases: PurchaseRecord[] = [];
  subscriptions: SubscriptionRecord[] = [];
  events: WebhookEventRecord[] = [];
  lsCustomerIds = new Map<number, string>();

  private nextId = 1;
  private id() {
    return this.nextId++;
  }

  async findUserById(id: number) {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async findUserByEmail(email: string) {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async createUser({ email, name }: { email: string; name: string | null }) {
    const user: UserRecord = { id: this.id(), email, name, tier: "none", tierExpiresAt: null };
    this.users.push(user);
    return user;
  }

  async updateUser(
    id: number,
    patch: Partial<{ tier: Tier; tierExpiresAt: Date | null; lsCustomerId: string }>,
  ) {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new Error(`no such user ${id}`);
    if (patch.lsCustomerId !== undefined) this.lsCustomerIds.set(id, patch.lsCustomerId);
    if (patch.tier !== undefined) user.tier = patch.tier;
    if (patch.tierExpiresAt !== undefined) user.tierExpiresAt = patch.tierExpiresAt;
  }

  async findPurchaseByOrderId(lsOrderId: string) {
    return this.purchases.find((p) => p.lsOrderId === lsOrderId) ?? null;
  }

  async findPurchaseByProductKey(userId: number, productKey: string) {
    return this.purchases.find((p) => p.userId === userId && p.productKey === productKey) ?? null;
  }

  async createPurchase(input: { userId: number; lsOrderId: string; productKey: string; status: string }) {
    this.purchases.push({
      id: this.id(),
      userId: input.userId,
      lsOrderId: input.lsOrderId,
      productKey: input.productKey,
      status: input.status,
    });
  }

  async updatePurchaseStatus(id: number, status: string) {
    const purchase = this.purchases.find((p) => p.id === id);
    if (purchase) purchase.status = status;
  }

  async findSubscriptionByLsId(lsSubscriptionId: string) {
    return this.subscriptions.find((s) => s.lsSubscriptionId === lsSubscriptionId) ?? null;
  }

  async findActiveSubscriptionForUser(userId: number) {
    return (
      this.subscriptions.find(
        (s) => s.userId === userId && ACTIVE_SUBSCRIPTION_STATUSES.includes(s.status),
      ) ?? null
    );
  }

  async createSubscription(input: {
    userId: number;
    lsSubscriptionId: string;
    status: string;
    renewsAt: Date | null;
    endsAt: Date | null;
  }) {
    this.subscriptions.push({
      id: this.id(),
      userId: input.userId,
      lsSubscriptionId: input.lsSubscriptionId,
      status: input.status,
      renewsAt: input.renewsAt,
      endsAt: input.endsAt,
    });
  }

  async updateSubscription(
    id: number,
    patch: Partial<{ status: string; renewsAt: Date | null; endsAt: Date | null }>,
  ) {
    const sub = this.subscriptions.find((s) => s.id === id);
    if (!sub) throw new Error(`no such subscription ${id}`);
    if (patch.status !== undefined) sub.status = patch.status;
    if (patch.renewsAt !== undefined) sub.renewsAt = patch.renewsAt;
    if (patch.endsAt !== undefined) sub.endsAt = patch.endsAt;
  }

  async findWebhookEventByLsId(lsEventId: string) {
    return this.events.find((e) => e.lsEventId === lsEventId) ?? null;
  }

  async createWebhookEvent({ lsEventId, eventName }: { lsEventId: string; eventName: string }) {
    // Mirrors the unique index on webhook_events.ls_event_id.
    if (this.events.some((e) => e.lsEventId === lsEventId)) {
      throw new Error(`duplicate ls_event_id ${lsEventId}`);
    }
    const row: WebhookEventRecord = { id: this.id(), lsEventId, eventName, processedAt: null, error: null };
    this.events.push(row);
    return row.id;
  }

  async markWebhookEventProcessed(id: number) {
    const row = this.events.find((e) => e.id === id);
    if (row) {
      row.processedAt = new Date();
      row.error = null;
    }
  }

  async markWebhookEventError(id: number, error: string) {
    const row = this.events.find((e) => e.id === id);
    if (row) row.error = error;
  }

  // --- assertions helpers ---

  userByEmail(email: string): UserRecord {
    const user = this.users.find((u) => u.email === email);
    if (!user) throw new Error(`no user with email ${email}; have ${this.users.map((u) => u.email).join(", ")}`);
    return user;
  }
}

export type TestHarness = {
  store: MemoryStore;
  deps: WebhookDeps;
  emails: SentEmail[];
  tokens: { userId: number; purpose: string }[];
  /** Subscription resources fetchSubscription will return, keyed by id. */
  subscriptionApi: Map<string, LemonSqueezyPayload["data"]>;
  fetchCalls: string[];
};

export function harness(overrides: Partial<WebhookDeps> = {}): TestHarness {
  const store = new MemoryStore();
  const emails: SentEmail[] = [];
  const tokens: { userId: number; purpose: string }[] = [];
  const subscriptionApi = new Map<string, LemonSqueezyPayload["data"]>();
  const fetchCalls: string[] = [];

  const deps: WebhookDeps = {
    store,
    async sendEmail(args) {
      emails.push(args);
    },
    async createPasswordToken(userId, purpose) {
      tokens.push({ userId, purpose });
      return `token-${userId}-${purpose}`;
    },
    // Matches the fixtures' variant ids without needing LS_VARIANT_* env vars.
    productKeyForVariantId(variantId) {
      return { "9101": "guide", "9201": "insider-monthly", "9202": "insider-yearly" }[String(variantId)] ?? null;
    },
    async fetchSubscription(id) {
      fetchCalls.push(id);
      const resource = subscriptionApi.get(id);
      if (!resource) throw new Error(`test: no subscription ${id} registered with the fake Lemon Squeezy API`);
      return resource;
    },
    appUrl: "https://example.test",
    ...overrides,
  };

  return { store, deps, emails, tokens, subscriptionApi, fetchCalls };
}

/** renews_at/ends_at + TIER_GRACE_DAYS, as a Date, for assertions. */
export function plusGraceDays(iso: string, days = 3): Date {
  return new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000);
}
