import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, purchases } from "@/db/schema";
import { getSession } from "./session";

export type Tier = "none" | "guide" | "insider";
export type UserRow = typeof users.$inferSelect;

const TIER_RANK: Record<Tier, number> = { none: 0, guide: 1, insider: 2 };

export async function getCurrentUser(): Promise<UserRow | null> {
  const session = await getSession();
  if (!session.userId) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  return user ?? null;
}

/**
 * Read-time tier downgrade, independent of whether the Lemon Squeezy webhook
 * that should have downgraded a lapsed subscriber ever ran. tierExpiresAt
 * already has the renewal grace period baked in by the webhook handler.
 */
export async function effectiveTier(user: UserRow): Promise<Tier> {
  const tier = user.tier as Tier;

  if (tier === "insider" && user.tierExpiresAt && user.tierExpiresAt < new Date()) {
    const [guidePurchase] = await db
      .select()
      .from(purchases)
      .where(and(eq(purchases.userId, user.id), eq(purchases.productKey, "guide")));
    return guidePurchase ? "guide" : "none";
  }

  return tier;
}

/** Redirects to /login if there's no session. Use in every gated layout/page/action. */
export async function requireUser(): Promise<UserRow> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Redirects non-admins back to the portal. Use in every /admin layout/page/action. */
export async function requireAdmin(): Promise<UserRow> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/portal");
  return user;
}

/**
 * Never redirects — callers render locked-teaser + upgrade CTA when this
 * returns false, per the internal upsell surface (docs/02-architecture.md §3).
 */
export async function requireTier(user: UserRow, minTier: "guide" | "insider"): Promise<boolean> {
  const tier = await effectiveTier(user);
  return TIER_RANK[tier] >= TIER_RANK[minTier];
}
