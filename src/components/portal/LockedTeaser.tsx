import type { ReactNode } from "react";
import { createCheckoutAction } from "@/lib/checkout-action";
import type { ProductKey } from "@/lib/lemonsqueezy";

const TIER_COPY = {
  guide: { badge: "Guide", cta: "Unlock the guide", productKey: "guide" as ProductKey },
  insider: { badge: "Insider", cta: "Upgrade to Insider", productKey: "insider-monthly" as ProductKey },
};

// The internal upsell surface (docs/02-architecture.md §3): gated content is
// never fetched for members below its tier — only a title/teaser renders.
export function LockedTeaser({
  title,
  teaser,
  requiredTier = "insider",
}: {
  title: string;
  teaser?: ReactNode;
  requiredTier?: "guide" | "insider";
}) {
  const { badge, cta, productKey } = TIER_COPY[requiredTier];
  return (
    <div className="rounded-xl border border-dashed border-brand-gold-500/60 bg-brand-green-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-500">
        {badge}
      </p>
      <p className="mt-1 font-medium text-brand-navy-950">{title}</p>
      {teaser ? <p className="mt-1 text-sm text-brand-navy-900/60">{teaser}</p> : null}
      <form action={createCheckoutAction.bind(null, productKey)} className="mt-3">
        <button
          type="submit"
          className="text-sm font-medium text-brand-green-600 hover:text-brand-green-700"
        >
          {cta} &rarr;
        </button>
      </form>
    </div>
  );
}
