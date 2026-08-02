import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, purchases } from "@/db/schema";
import { getSession } from "./session";
import { TIER_RANK, resolveEffectiveTier, type Tier } from "./tiers";

export { TIER_RANK, type Tier };
export type UserRow = typeof users.$inferSelect;

export async function getCurrentUser(): Promise<UserRow | null> {
  const session = await getSession();
  if (!session.userId) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  return user ?? null;
}

/**
 * Read-time tier downgrade — see resolveEffectiveTier in ./tiers for the rule.
 * The guide-purchase lookup is only needed on the expiry path, so it stays
 * behind the same condition rather than running on every request.
 */
export async function effectiveTier(user: UserRow): Promise<Tier> {
  const tier = user.tier as Tier;
  const now = new Date();

  if (tier === "insider" && user.tierExpiresAt && user.tierExpiresAt < now) {
    const [guidePurchase] = await db
      .select()
      .from(purchases)
      .where(and(eq(purchases.userId, user.id), eq(purchases.productKey, "guide")));
    return resolveEffectiveTier({
      tier,
      tierExpiresAt: user.tierExpiresAt,
      now,
      hasGuidePurchase: Boolean(guidePurchase),
    });
  }

  return resolveEffectiveTier({ tier, tierExpiresAt: user.tierExpiresAt ?? null, now, hasGuidePurchase: false });
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
