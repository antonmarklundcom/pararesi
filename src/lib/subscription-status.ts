/**
 * `past_due` is Lemon Squeezy's state for "the renewal payment failed and
 * we're retrying it". Access continues during that window (it's in
 * ACTIVE_SUBSCRIPTION_STATUSES, and TIER_GRACE_DAYS covers the retry), so the
 * member notices nothing until the subscription is cancelled out from under
 * them. This is the check behind the in-portal dunning banner (docs/07 C5).
 */
export const PAST_DUE_STATUS = "past_due";

export function isPastDue(subscription: { status: string } | undefined | null): boolean {
  return subscription?.status === PAST_DUE_STATUS;
}
