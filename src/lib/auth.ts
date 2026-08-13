import { redirect } from "next/navigation";
import { eq, and, ne } from "drizzle-orm";
import { db } from "@/db";
import { users, purchases } from "@/db/schema";
import { getSession, sessionEpochMatches } from "./session";
import { TIER_RANK, resolveEffectiveTier, type Tier } from "./tiers";

export { TIER_RANK, type Tier };
export type UserRow = typeof users.$inferSelect;

export async function getCurrentUser(): Promise<UserRow | null> {
  const session = await getSession();
  if (!session.userId) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  if (!user) return null;

  // A session issued before the account's last password change is no longer a
  // session. Checked here rather than in middleware because middleware has no
  // database access — and because this is the function every gate goes through.
  if (!sessionEpochMatches(session.epoch, user.sessionEpoch)) return null;

  return user;
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
    // Refunded purchases don't count — matches findGuidePurchase in the
    // webhook store, so a read-time downgrade lands on the same tier the
    // webhook handlers would have written.
    const [guidePurchase] = await db
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.userId, user.id),
          eq(purchases.productKey, "guide"),
          ne(purchases.status, "refunded"),
        ),
      );
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
