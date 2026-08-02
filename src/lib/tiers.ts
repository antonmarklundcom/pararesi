/**
 * Tier vocabulary and the pure read-time downgrade rule.
 *
 * Kept free of database and next/navigation imports so the money logic can be
 * unit-tested directly; `@/lib/auth` re-exports these and supplies the
 * database reads.
 */

export type Tier = "none" | "guide" | "insider";

export const TIER_RANK: Record<Tier, number> = { none: 0, guide: 1, insider: 2 };

/**
 * Decides the tier a user actually has right now, independent of whether the
 * Lemon Squeezy webhook that should have downgraded a lapsed subscriber ever
 * ran. `tierExpiresAt` already has the renewal grace period baked in by the
 * webhook handler (see TIER_GRACE_DAYS).
 *
 * The boundary is inclusive of `tierExpiresAt` itself: access is kept until
 * that instant has actually passed.
 */
export function resolveEffectiveTier(args: {
  tier: Tier;
  tierExpiresAt: Date | null;
  now: Date;
  hasGuidePurchase: boolean;
}): Tier {
  const { tier, tierExpiresAt, now, hasGuidePurchase } = args;

  if (tier === "insider" && tierExpiresAt && tierExpiresAt < now) {
    return hasGuidePurchase ? "guide" : "none";
  }

  return tier;
}
