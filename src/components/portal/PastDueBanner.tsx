import { manageSubscriptionAction } from "@/app/portal/account/actions";

/**
 * Shown on every portal page while a subscription is `past_due`. Lemon Squeezy
 * sends its own dunning emails; this catches the members who don't read them,
 * before the retries run out and the subscription is cancelled.
 */
export function PastDueBanner() {
  return (
    <div className="mb-6 rounded-xl border border-brand-gold-500/60 bg-brand-gold-500/10 p-4">
      <p className="font-medium text-brand-navy-950">Your last payment didn&apos;t go through.</p>
      <p className="mt-1 text-sm text-brand-navy-900/70">
        You still have access while the payment is retried. Update your card to keep it that way.
      </p>
      <form action={manageSubscriptionAction} className="mt-3">
        <button
          type="submit"
          className="text-sm font-medium text-brand-green-600 hover:text-brand-green-700"
        >
          Update payment method &rarr;
        </button>
      </form>
    </div>
  );
}
