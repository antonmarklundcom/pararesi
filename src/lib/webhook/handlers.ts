import { TIER_RANK, type Tier } from "@/lib/tiers";
import { lsEventId, type LemonSqueezyPayload } from "@/lib/ls-webhook";
import { trackServerEvent } from "@/lib/analytics";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  TIER_GRACE_DAYS,
  type SubscriptionRecord,
  type UserRecord,
  type WebhookDeps,
} from "./types";

export type ProcessResult =
  | { status: "duplicate" }
  | { status: "processed" }
  | { status: "failed"; error: Error };

/**
 * Dedupe, log and dispatch one webhook delivery.
 *
 * Returns rather than throws so the route can decide the HTTP status: a
 * duplicate is a 200 (Lemon Squeezy has already been told we got it), a
 * failure is the caller's to escalate.
 */
export async function processWebhook(payload: LemonSqueezyPayload, deps: WebhookDeps): Promise<ProcessResult> {
  const { store } = deps;
  const eventName = payload.meta?.event_name ?? "unknown";
  const eventId = lsEventId(payload);

  const existing = await store.findWebhookEventByLsId(eventId);
  if (existing) return { status: "duplicate" };

  // The check above is not atomic: Lemon Squeezy can have two deliveries of the
  // same event in flight, and both can pass it. The unique index on
  // webhook_events.ls_event_id is the real guard, so a failed insert is read as
  // "someone else got there first" rather than escaping as an unhandled 500 —
  // otherwise the winning delivery is processed and the loser reports failure.
  let rowId: number;
  try {
    rowId = await store.createWebhookEvent({ lsEventId: eventId, eventName, raw: payload });
  } catch {
    return { status: "duplicate" };
  }

  try {
    await handleEvent(eventName, payload, deps);
    await store.markWebhookEventProcessed(rowId);
    return { status: "processed" };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await store.markWebhookEventError(rowId, error.message);
    return { status: "failed", error };
  }
}

/**
 * Re-runs an already-logged webhook event against the current handlers,
 * without going through the dedupe check (the row exists by definition).
 *
 * This is the manual recovery path for an event that failed the first time —
 * a Lemon Squeezy API blip during a renewal, say. Handlers are written to be
 * safe to re-apply: purchases and subscriptions are looked up before insert,
 * and tier/tierExpiresAt are computed from the payload rather than
 * incremented, so a replay converges on the same state.
 */
export async function replayWebhookEvent(eventRowId: number, deps: WebhookDeps): Promise<ProcessResult> {
  const row = await deps.store.findWebhookEventById(eventRowId);
  if (!row) throw new Error(`No webhook_events row with id ${eventRowId}`);

  const payload = row.raw as LemonSqueezyPayload;
  if (!payload?.meta?.event_name) {
    throw new Error(`webhook_events row ${eventRowId} has no usable raw payload to replay`);
  }

  try {
    await handleEvent(payload.meta.event_name, payload, deps);
    await deps.store.markWebhookEventProcessed(eventRowId);
    return { status: "processed" };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await deps.store.markWebhookEventError(eventRowId, error.message);
    return { status: "failed", error };
  }
}

async function handleEvent(eventName: string, payload: LemonSqueezyPayload, deps: WebhookDeps) {
  switch (eventName) {
    case "order_created":
      return handleOrderCreated(payload, deps);
    case "order_refunded":
      return handleOrderRefunded(payload, deps);
    case "subscription_created":
    case "subscription_resumed":
    case "subscription_unpaused":
      return handleSubscriptionActive(payload.data, payload.meta.custom_data, deps);
    case "subscription_payment_success":
      return handleSubscriptionPaymentSuccess(payload, deps);
    case "subscription_cancelled":
      return handleSubscriptionCancelled(payload, deps);
    case "subscription_expired":
      return handleSubscriptionEnded(payload, deps);
    // Other event types (subscription_updated, subscription_paused,
    // subscription_payment_failed, license_key_*, etc.) are logged by
    // processWebhook above but intentionally not acted on.
  }
}

// --- User resolution ---

async function findOrCreateUser(rawEmail: string, name: string | null, deps: WebhookDeps) {
  const email = rawEmail.trim().toLowerCase();
  const existing = await deps.store.findUserByEmail(email);
  if (existing) return { user: existing, isNew: false };

  const created = await deps.store.createUser({ email, name });
  return { user: created, isNew: true };
}

/**
 * Prefers the logged-in buyer's userId (passed through checkout_data.custom)
 * over email matching, so a member who types a different email at Lemon
 * Squeezy checkout still gets their existing account upgraded instead of a
 * new orphan account being created for that email.
 *
 * `knownUser` lets subscription events skip email matching entirely once the
 * subscription row already exists — a renewal invoice is unambiguously the
 * same member as the original signup, whatever email is on the invoice.
 */
async function resolveUser(
  customData: Record<string, string> | undefined,
  email: string,
  name: string | null,
  deps: WebhookDeps,
  knownUser?: UserRecord | null,
) {
  // NOTE: `customData` is buyer-influenced, not server-authoritative — a Lemon
  // Squeezy hosted checkout accepts `checkout[custom][...]` straight off the
  // URL. Attributing a purchase to another account id is only ever a gift (the
  // attacker is the one paying), so it stays trusted here; nothing that decides
  // *what was bought* may come from it. See handleOrderCreated.
  const customUserId = customData?.userId;
  if (customUserId) {
    const existing = await deps.store.findUserById(Number(customUserId));
    if (existing) return { user: existing, isNew: false };
  }
  if (knownUser) return { user: knownUser, isNew: false };
  return findOrCreateUser(email, name, deps);
}

async function grantAtLeastTier(userId: number, currentTier: Tier, minTier: Tier, deps: WebhookDeps) {
  if (TIER_RANK[currentTier] < TIER_RANK[minTier]) {
    await deps.store.updateUser(userId, { tier: minTier });
  }
}

async function sendWelcomeEmail(userId: number, email: string, name: string | null, deps: WebhookDeps) {
  const token = await deps.createPasswordToken(userId, "set");
  const setPasswordUrl = `${deps.appUrl}/set-password?token=${token}`;
  await deps.sendEmail({ to: email, template: "welcome-set-password", data: { setPasswordUrl, name: name ?? "" } });
}

/** paid-through date + grace, the value effectiveTier reads at request time. */
function withGrace(paidThrough: Date): Date {
  return new Date(paidThrough.getTime() + TIER_GRACE_DAYS * 24 * 60 * 60 * 1000);
}

// --- Orders ---

async function handleOrderCreated(payload: LemonSqueezyPayload, deps: WebhookDeps) {
  const attrs = payload.data.attributes as unknown as {
    user_email: string;
    user_name?: string;
    customer_id?: number | string;
    total: number;
    status: string;
    first_order_item: { product_id: number | string; variant_id: number | string };
  };

  const orderId = payload.data.id;
  const email = attrs.user_email;
  const name = attrs.user_name ?? null;

  const { user, isNew } = await resolveUser(payload.meta.custom_data, email, name, deps);

  if (attrs.customer_id) {
    await deps.store.updateUser(user.id, { lsCustomerId: String(attrs.customer_id) });
  }

  // Derived from the variant id alone, never from meta.custom_data: custom data
  // rides in on the checkout URL, so a buyer can set it to anything. Taking
  // `custom_data.productKey` on trust let a buyer pay for one variant and be
  // granted the entitlement of another, and wrote the wrong product into the
  // purchases ledger.
  //
  // No silent fallback to "guide" either: a misconfigured LS_VARIANT_* env var
  // used to downgrade an insider purchase to the cheaper product without a
  // trace. Throwing records the event with an error and returns a 500, so Lemon
  // Squeezy retries and the order can be applied once the mapping is fixed.
  const variantId = attrs.first_order_item.variant_id;
  const productKey = deps.productKeyForVariantId(variantId);
  if (!productKey) {
    throw new Error(
      `order_created ${orderId}: variant_id ${variantId} maps to no productKey. ` +
        `Check LS_VARIANT_GUIDE / LS_VARIANT_INSIDER_MONTHLY / LS_VARIANT_INSIDER_YEARLY against the Lemon Squeezy dashboard.`,
    );
  }

  const existingPurchase = await deps.store.findPurchaseByOrderId(orderId);
  if (!existingPurchase) {
    await deps.store.createPurchase({
      userId: user.id,
      lsOrderId: orderId,
      lsProductId: String(attrs.first_order_item.product_id),
      lsVariantId: String(attrs.first_order_item.variant_id),
      productKey,
      amountUsd: attrs.total, // cents, as returned by Lemon Squeezy's `total` field
      status: attrs.status,
      raw: payload,
    });
    await trackServerEvent("Purchase completed", { productKey });
  }

  if (productKey === "guide") {
    await grantAtLeastTier(user.id, user.tier, "guide", deps);
  }

  // A returning customer who never followed their first set-password link has
  // no way into the portal, so "payment received, log in" is a dead end for
  // them — they get a fresh set-password link instead.
  if (isNew || !user.hasPassword) {
    await sendWelcomeEmail(user.id, email, name, deps);
  } else {
    await deps.sendEmail({
      to: email,
      template: "payment-received",
      data: { name: name ?? "", portalUrl: `${deps.appUrl}/portal` },
    });
  }
}

/**
 * Recomputes what a user is entitled to from what they currently hold, rather
 * than mutating the tier they happen to be on.
 *
 * The old refund path only acted when `user.tier === "guide"`, so a refund for
 * a member whose tier had drifted anywhere else was a silent no-op. Deriving
 * the tier makes the rule total, and makes it agree with subscription_expired.
 */
async function entitledTier(userId: number, deps: WebhookDeps): Promise<Tier> {
  const activeSub = await deps.store.findActiveSubscriptionForUser(userId);
  if (activeSub) return "insider";

  const guidePurchase = await deps.store.findGuidePurchase(userId);
  return guidePurchase ? "guide" : "none";
}

async function handleOrderRefunded(payload: LemonSqueezyPayload, deps: WebhookDeps) {
  const orderId = payload.data.id;

  const purchase = await deps.store.findPurchaseByOrderId(orderId);
  if (!purchase) return;

  await deps.store.updatePurchaseStatus(purchase.id, "refunded");

  const user = await deps.store.findUserById(purchase.userId);
  if (!user) return;

  const tier = await entitledTier(user.id, deps);

  // Never *raise* a tier on a refund. A member sitting above what they are
  // entitled to may have been granted it by hand in /admin/users, and a
  // refund of an unrelated order is not the event that should revoke that.
  if (TIER_RANK[tier] < TIER_RANK[user.tier]) {
    // Clearing tierExpiresAt matters when dropping out of insider: a stale
    // future date would otherwise keep effectiveTier from ever re-checking.
    await deps.store.updateUser(user.id, {
      tier,
      ...(tier === "insider" ? {} : { tierExpiresAt: null }),
    });
  }
}

// --- Subscriptions ---

/**
 * Applies a Lemon Squeezy `subscriptions` object: upsert the subscription row
 * and put the member on insider until renews_at + grace.
 *
 * Takes the resource rather than the whole payload because
 * subscription_payment_success has to fetch the subscription separately —
 * its own payload is an invoice.
 */
async function handleSubscriptionActive(
  resource: LemonSqueezyPayload["data"],
  customData: Record<string, string> | undefined,
  deps: WebhookDeps,
) {
  const attrs = resource.attributes as unknown as {
    user_email: string;
    user_name?: string;
    customer_id?: number | string;
    status: string;
    renews_at: string | null;
    ends_at: string | null;
  };

  const subscriptionId = resource.id;
  const email = attrs.user_email;
  const name = attrs.user_name ?? null;

  const existingSub = await deps.store.findSubscriptionByLsId(subscriptionId);
  const knownUser = existingSub ? await deps.store.findUserById(existingSub.userId) : null;

  const { user, isNew } = await resolveUser(customData, email, name, deps, knownUser);

  if (attrs.customer_id) {
    await deps.store.updateUser(user.id, { lsCustomerId: String(attrs.customer_id) });
  }

  const renewsAt = attrs.renews_at ? new Date(attrs.renews_at) : null;
  const endsAt = attrs.ends_at ? new Date(attrs.ends_at) : null;

  if (existingSub) {
    await deps.store.updateSubscription(existingSub.id, { status: attrs.status, renewsAt, endsAt, raw: resource });
  } else {
    await deps.store.createSubscription({
      userId: user.id,
      lsSubscriptionId: subscriptionId,
      status: attrs.status,
      renewsAt,
      endsAt,
      raw: resource,
    });
  }

  // `renews_at` is null on a subscription that won't renew (cancelled, or
  // ending after the current period), and those payloads still arrive here via
  // subscription_resumed / subscription_payment_success. Writing null into
  // tierExpiresAt in that case is not "no expiry information", it is *lifetime
  // insider*: resolveEffectiveTier only ever downgrades a member who has a date
  // to compare against. Fall back to ends_at, and failing that keep whatever
  // paid-through date the member already had rather than clearing it.
  const paidThrough = renewsAt ?? endsAt;
  await deps.store.updateUser(user.id, {
    tier: "insider",
    tierExpiresAt: paidThrough ? withGrace(paidThrough) : (user.tierExpiresAt ?? null),
  });

  if (isNew || !user.hasPassword) {
    await sendWelcomeEmail(user.id, email, name, deps);
  }
}

/**
 * subscription_payment_success delivers a `subscription-invoices` object, not
 * a `subscriptions` one. That object has an id of its own (unique per
 * invoice, which is what makes renewals survive the idempotency check) but it
 * carries no renews_at, no ends_at, and its `status` is the *invoice* status
 * (paid/pending/void/refunded), not the subscription status. So the new
 * paid-through date has to come from the subscription itself, fetched from
 * the API. A failed fetch throws, which the route turns into a 500 so Lemon
 * Squeezy retries rather than silently leaving the member unrenewed.
 */
async function handleSubscriptionPaymentSuccess(payload: LemonSqueezyPayload, deps: WebhookDeps) {
  // Defensive: if a payload ever arrives already shaped as a subscription
  // (older/replayed captures), use it directly instead of re-fetching.
  if (payload.data.type === "subscriptions") {
    return handleSubscriptionActive(payload.data, payload.meta.custom_data, deps);
  }

  const attrs = payload.data.attributes as unknown as { subscription_id?: number | string };
  const subscriptionId = attrs.subscription_id;
  if (subscriptionId === undefined || subscriptionId === null) {
    throw new Error(
      `subscription_payment_success payload (data.type="${payload.data.type}", id=${payload.data.id}) has no attributes.subscription_id`,
    );
  }

  const subscription = await deps.fetchSubscription(String(subscriptionId));
  return handleSubscriptionActive(subscription, payload.meta.custom_data, deps);
}

/**
 * subscription_cancelled means the member cancelled but stays paid-up until
 * the current period ends — it is NOT the downgrade event. Downgrading here
 * would strip access the member already paid for. We just push tierExpiresAt
 * out to ends_at (+ grace) so effectiveTier's read-time check naturally
 * downgrades once the paid period is actually over. subscription_expired is
 * the real terminal event (handleSubscriptionEnded).
 */
async function handleSubscriptionCancelled(payload: LemonSqueezyPayload, deps: WebhookDeps) {
  const attrs = payload.data.attributes as unknown as {
    status: string;
    ends_at: string | null;
    renews_at: string | null;
  };

  const sub = await deps.store.findSubscriptionByLsId(payload.data.id);
  if (!sub) return;

  const endsAt = attrs.ends_at ? new Date(attrs.ends_at) : null;
  const renewsAt = attrs.renews_at ? new Date(attrs.renews_at) : null;

  await deps.store.updateSubscription(sub.id, { status: attrs.status, endsAt, raw: payload });

  const paidThrough = endsAt ?? renewsAt;
  if (paidThrough) {
    await deps.store.updateUser(sub.userId, { tierExpiresAt: withGrace(paidThrough) });
  }
}

async function handleSubscriptionEnded(payload: LemonSqueezyPayload, deps: WebhookDeps) {
  const attrs = payload.data.attributes as unknown as { status: string; ends_at: string | null };

  const sub: SubscriptionRecord | null = await deps.store.findSubscriptionByLsId(payload.data.id);
  if (!sub) return;

  await deps.store.updateSubscription(sub.id, {
    status: attrs.status,
    endsAt: attrs.ends_at ? new Date(attrs.ends_at) : null,
  });

  const user = await deps.store.findUserById(sub.userId);
  if (!user) return;

  // Derived from everything the member still holds, not just their guide
  // purchase: a member with a second, still-active subscription (they
  // resubscribed, or someone else's checkout was attributed to their account
  // via checkout custom data) must not be downgraded because an older
  // subscription reached its end. The just-ended subscription is already
  // written as expired above, so it cannot count towards this.
  const otherActive = await deps.store.findActiveSubscriptionForUser(user.id);
  if (otherActive) {
    const paidThrough = otherActive.renewsAt ?? otherActive.endsAt;
    await deps.store.updateUser(user.id, {
      tier: "insider",
      // Re-anchored to the surviving subscription, so the expired one's date
      // can't strand them on an insider tier that expires immediately.
      ...(paidThrough ? { tierExpiresAt: withGrace(paidThrough) } : {}),
    });
    return;
  }

  const guidePurchase = await deps.store.findGuidePurchase(user.id);
  await deps.store.updateUser(user.id, { tier: guidePurchase ? "guide" : "none", tierExpiresAt: null });
}

export { ACTIVE_SUBSCRIPTION_STATUSES };
