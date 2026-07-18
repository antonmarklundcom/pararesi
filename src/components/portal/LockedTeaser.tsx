import type { ReactNode } from "react";
import { createCheckoutAction } from "@/lib/checkout-action";

// The internal upsell surface (docs/02-architecture.md §3): insider-only
// content is never fetched for guide members — only a title/teaser renders.
export function LockedTeaser({ title, teaser }: { title: string; teaser?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-brand-gold-500/60 bg-brand-green-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-500">
        Insider
      </p>
      <p className="mt-1 font-medium text-brand-navy-950">{title}</p>
      {teaser ? <p className="mt-1 text-sm text-brand-navy-900/60">{teaser}</p> : null}
      <form action={createCheckoutAction.bind(null, "insider-monthly")} className="mt-3">
        <button
          type="submit"
          className="text-sm font-medium text-brand-green-600 hover:text-brand-green-700"
        >
          Upgrade to Insider &rarr;
        </button>
      </form>
    </div>
  );
}
