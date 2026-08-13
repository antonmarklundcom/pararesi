import { TIER_RANK, resolveEffectiveTier, type Tier } from "@/lib/tiers";

/**
 * C4 retention (docs/07): when an update post is published, the members who
 * paid for the updates feed should hear about it. The eligibility rules are
 * pure so they can be tested without a database — the admin action supplies
 * the rows.
 */

export type NotifiablePost = {
  id: number;
  title: string;
  minTier: Tier;
  status: "draft" | "published";
  publishedAt: Date | null;
  notifiedAt: Date | null;
};

export type NotifyBlockedReason =
  | "not-published"
  | "no-publish-date"
  | "publish-date-in-future"
  | "already-notified";

export type NotifyEligibility = { ok: true } | { ok: false; reason: NotifyBlockedReason };

/**
 * Whether this post may be notified about right now.
 *
 * `already-notified` is the important one: it's what makes editing a live post,
 * or flipping it back to draft and publishing again, safe. A post gets exactly
 * one notification in its lifetime.
 */
export function canNotifyAboutUpdate(post: NotifiablePost, now: Date): NotifyEligibility {
  if (post.status !== "published") return { ok: false, reason: "not-published" };
  if (!post.publishedAt) return { ok: false, reason: "no-publish-date" };
  if (post.publishedAt > now) return { ok: false, reason: "publish-date-in-future" };
  if (post.notifiedAt) return { ok: false, reason: "already-notified" };
  return { ok: true };
}

export type NotifiableMember = {
  id: number;
  email: string;
  name: string | null;
  tier: Tier;
  tierExpiresAt: Date | null;
  /**
   * `users.update_emails_enabled` — the member's own choice, set on
   * /portal/account. Applies to this notification and nothing else: password,
   * purchase and payment mail is transactional and is sent regardless.
   */
  updateEmailsEnabled: boolean;
};

/**
 * The members who should be emailed about a post.
 *
 * Two independent gates, and a member has to pass both.
 *
 * Access is the same rule the portal uses, so nobody is told about content
 * they'd be shown a locked teaser for: a lapsed insider whose `tierExpiresAt`
 * has passed is filtered out by `resolveEffectiveTier` even if the downgrade
 * webhook never landed. `hasGuidePurchase` is deliberately false here — the
 * worst case is that a lapsed insider who also bought the guide is left out of
 * one guide-tier notification, which is better than mailing someone who has
 * lost access.
 *
 * Consent is the member's own setting. Entitlement is not consent: paying for
 * the updates feed says they may read it in the portal, not that they want an
 * email every time it changes. This is the same principle the lead side has
 * had since the unsubscribe work — it was only the member side that had no
 * way out.
 */
export function updateNotifyRecipients(
  members: readonly NotifiableMember[],
  post: NotifiablePost,
  now: Date,
): NotifiableMember[] {
  const required = TIER_RANK[post.minTier];

  return members.filter((member) => {
    if (!member.updateEmailsEnabled) return false;

    const tier = resolveEffectiveTier({
      tier: member.tier,
      tierExpiresAt: member.tierExpiresAt,
      now,
      hasGuidePurchase: false,
    });
    return TIER_RANK[tier] >= required;
  });
}
