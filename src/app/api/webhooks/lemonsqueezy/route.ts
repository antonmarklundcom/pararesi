import crypto from "crypto";
import { NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { webhookEvents, users, purchases, subscriptions } from "@/db/schema";
import { TIER_RANK, type Tier } from "@/lib/auth";
import { productKeyForVariantId } from "@/lib/lemonsqueezy";
import { createPasswordToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const TIER_GRACE_DAYS = 3;
const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "on_trial", "past_due"];

type LemonSqueezyPayload = {
  meta: { event_name: string; custom_data?: Record<string, string> };
  data: { id: string; type: string; attributes: Record<string, unknown> };
};

function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const digestBuffer = Buffer.from(digest, "utf8");
  const signatureBuffer = Buffer.from(signatureHeader, "utf8");
  if (digestBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(digestBuffer, signatureBuffer);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const signatureHeader = request.headers.get("x-signature");

  if (!secret || !verifySignature(rawBody, signatureHeader, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: LemonSqueezyPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventName = payload.meta?.event_name ?? "unknown";
  const resourceId = payload.data?.id ?? "unknown";
  // Lemon Squeezy doesn't send a dedicated delivery id, so event_name+resource
  // id is the idempotency key: a retried delivery of the same event is a
  // no-op, and each distinct event for a resource still gets its own row.
  const lsEventId = `${eventName}:${resourceId}`;

  const [existingEvent] = await db.select().from(webhookEvents).where(eq(webhookEvents.lsEventId, lsEventId));
  if (existingEvent) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const [insertedEvent] = await db
    .insert(webhookEvents)
    .values({ lsEventId, eventName, raw: payload })
    .$returningId();

  try {
    await handleEvent(eventName, payload);
    await db
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvents.id, insertedEvent.id));
  } catch (err) {
    await db
      .update(webhookEvents)
      .set({ error: err instanceof Error ? err.message : String(err) })
      .where(eq(webhookEvents.id, insertedEvent.id));
  }

  // Always 200 (except a bad signature) so Lemon Squeezy doesn't endlessly retry;
  // failures are visible in the webhookEvents.error column for follow-up.
  return NextResponse.json({ ok: true });
}

async function handleEvent(eventName: string, payload: LemonSqueezyPayload) {
  switch (eventName) {
    case "order_created":
      return handleOrderCreated(payload);
    case "order_refunded":
      return handleOrderRefunded(payload);
    case "subscription_created":
    case "subscription_payment_success":
    case "subscription_resumed":
    case "subscription_unpaused":
      return handleSubscriptionActive(payload);
    case "subscription_cancelled":
      return handleSubscriptionCancelled(payload);
    case "subscription_expired":
      return handleSubscriptionEnded(payload);
    // Other event types (subscription_updated, subscription_paused, license_key_*,
    // etc.) are logged to webhookEvents above but intentionally not acted on.
  }
}

async function findOrCreateUser(rawEmail: string, name: string | null) {
  const email = rawEmail.trim().toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) return { user: existing, isNew: false };

  const [inserted] = await db
    .insert(users)
    .values({ email, name: name ?? undefined, role: "member", tier: "none" })
    .$returningId();
  const [created] = await db.select().from(users).where(eq(users.id, inserted.id));
  return { user: created!, isNew: true };
}

/**
 * Prefers the logged-in buyer's userId (passed through checkout_data.custom)
 * over email matching, so a member who types a different email at Lemon
 * Squeezy checkout still gets their existing account upgraded instead of a
 * new orphan account being created for that email.
 */
async function resolveUser(payload: LemonSqueezyPayload, email: string, name: string | null) {
  const customUserId = payload.meta.custom_data?.userId;
  if (customUserId) {
    const [existing] = await db.select().from(users).where(eq(users.id, Number(customUserId)));
    if (existing) return { user: existing, isNew: false };
  }
  return findOrCreateUser(email, name);
}

async function grantAtLeastTier(userId: number, currentTier: string, minTier: Tier) {
  if (TIER_RANK[currentTier as Tier] < TIER_RANK[minTier]) {
    await db.update(users).set({ tier: minTier }).where(eq(users.id, userId));
  }
}

async function sendWelcomeEmail(userId: number, email: string, name: string | null) {
  const token = await createPasswordToken(userId, "set");
  const setPasswordUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/set-password?token=${token}`;
  await sendEmail({ to: email, template: "welcome-set-password", data: { setPasswordUrl, name: name ?? "" } });
}

async function handleOrderCreated(payload: LemonSqueezyPayload) {
  const attrs = payload.data.attributes as {
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

  const { user, isNew } = await resolveUser(payload, email, name);

  if (attrs.customer_id) {
    await db.update(users).set({ lsCustomerId: String(attrs.customer_id) }).where(eq(users.id, user.id));
  }

  const productKey =
    payload.meta.custom_data?.productKey ?? productKeyForVariantId(attrs.first_order_item.variant_id) ?? "guide";

  const [existingPurchase] = await db.select().from(purchases).where(eq(purchases.lsOrderId, orderId));
  if (!existingPurchase) {
    await db.insert(purchases).values({
      userId: user.id,
      lsOrderId: orderId,
      lsProductId: String(attrs.first_order_item.product_id),
      lsVariantId: String(attrs.first_order_item.variant_id),
      productKey,
      amountUsd: attrs.total, // cents, as returned by Lemon Squeezy's `total` field
      status: attrs.status,
      raw: payload,
    });
  }

  if (productKey === "guide") {
    await grantAtLeastTier(user.id, user.tier, "guide");
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  if (isNew) {
    await sendWelcomeEmail(user.id, email, name);
  } else {
    await sendEmail({
      to: email,
      template: "payment-received",
      data: { name: name ?? "", portalUrl: `${appUrl}/portal` },
    });
  }
}

async function handleOrderRefunded(payload: LemonSqueezyPayload) {
  const orderId = payload.data.id;

  const [purchase] = await db.select().from(purchases).where(eq(purchases.lsOrderId, orderId));
  if (!purchase) return;

  await db.update(purchases).set({ status: "refunded" }).where(eq(purchases.id, purchase.id));

  const [user] = await db.select().from(users).where(eq(users.id, purchase.userId));
  if (!user || user.tier !== "guide") return;

  const [activeSub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), inArray(subscriptions.status, ACTIVE_SUBSCRIPTION_STATUSES)));

  if (!activeSub) {
    await db.update(users).set({ tier: "none" }).where(eq(users.id, user.id));
  }
}

async function handleSubscriptionActive(payload: LemonSqueezyPayload) {
  const attrs = payload.data.attributes as {
    user_email: string;
    user_name?: string;
    customer_id?: number | string;
    status: string;
    renews_at: string | null;
    ends_at: string | null;
  };

  const subscriptionId = payload.data.id;
  const email = attrs.user_email;
  const name = attrs.user_name ?? null;

  const { user, isNew } = await resolveUser(payload, email, name);

  if (attrs.customer_id) {
    await db.update(users).set({ lsCustomerId: String(attrs.customer_id) }).where(eq(users.id, user.id));
  }

  const renewsAt = attrs.renews_at ? new Date(attrs.renews_at) : null;
  const endsAt = attrs.ends_at ? new Date(attrs.ends_at) : null;

  const [existingSub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.lsSubscriptionId, subscriptionId));

  if (existingSub) {
    await db
      .update(subscriptions)
      .set({ status: attrs.status, renewsAt, endsAt, raw: payload })
      .where(eq(subscriptions.id, existingSub.id));
  } else {
    await db.insert(subscriptions).values({
      userId: user.id,
      lsSubscriptionId: subscriptionId,
      status: attrs.status,
      renewsAt,
      endsAt,
      raw: payload,
    });
  }

  const tierExpiresAt = renewsAt ? new Date(renewsAt.getTime() + TIER_GRACE_DAYS * 24 * 60 * 60 * 1000) : null;
  await db.update(users).set({ tier: "insider", tierExpiresAt }).where(eq(users.id, user.id));

  if (isNew) {
    await sendWelcomeEmail(user.id, email, name);
  }
}

/**
 * subscription_cancelled means the member cancelled but stays paid-up until
 * the current period ends — it is NOT the downgrade event. Downgrading here
 * would strip access the member already paid for. We just push tierExpiresAt
 * out to ends_at (+ grace) so effectiveTier's read-time check naturally
 * downgrades once the paid period is actually over. subscription_expired is
 * the real terminal event (handleSubscriptionEnded).
 */
async function handleSubscriptionCancelled(payload: LemonSqueezyPayload) {
  const attrs = payload.data.attributes as {
    status: string;
    ends_at: string | null;
    renews_at: string | null;
  };
  const subscriptionId = payload.data.id;

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.lsSubscriptionId, subscriptionId));
  if (!sub) return;

  const endsAt = attrs.ends_at ? new Date(attrs.ends_at) : null;
  const renewsAt = attrs.renews_at ? new Date(attrs.renews_at) : null;

  await db
    .update(subscriptions)
    .set({ status: attrs.status, endsAt, raw: payload })
    .where(eq(subscriptions.id, sub.id));

  const paidThrough = endsAt ?? renewsAt;
  if (paidThrough) {
    const tierExpiresAt = new Date(paidThrough.getTime() + TIER_GRACE_DAYS * 24 * 60 * 60 * 1000);
    await db.update(users).set({ tierExpiresAt }).where(eq(users.id, sub.userId));
  }
}

async function handleSubscriptionEnded(payload: LemonSqueezyPayload) {
  const attrs = payload.data.attributes as { status: string; ends_at: string | null };
  const subscriptionId = payload.data.id;

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.lsSubscriptionId, subscriptionId));
  if (!sub) return;

  await db
    .update(subscriptions)
    .set({ status: attrs.status, endsAt: attrs.ends_at ? new Date(attrs.ends_at) : null })
    .where(eq(subscriptions.id, sub.id));

  const [user] = await db.select().from(users).where(eq(users.id, sub.userId));
  if (!user) return;

  const [guidePurchase] = await db
    .select()
    .from(purchases)
    .where(and(eq(purchases.userId, user.id), eq(purchases.productKey, "guide")));

  await db
    .update(users)
    .set({ tier: guidePurchase ? "guide" : "none", tierExpiresAt: null })
    .where(eq(users.id, user.id));
}
