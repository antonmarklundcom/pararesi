"use client";

import { useState } from "react";
import { createCheckoutAction } from "@/lib/checkout-action";
import { Button } from "@/components/ui/Button";
import { siteConfig } from "@/config/site";
import { trackClientEvent } from "@/lib/analytics";

export function InsiderPricingCard() {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const productKey = period === "monthly" ? "insider-monthly" : "insider-yearly";

  return (
    <div className="rounded-2xl border-2 border-brand-green-600 bg-white p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-green-600">
        Most popular
      </p>
      <h3 className="mt-2 text-xl font-semibold text-brand-navy-950">Insider</h3>
      <p className="mt-2 text-sm text-brand-navy-900/60">
        Everything in the Guide, plus advanced modules, templates, and ongoing updates.
      </p>

      <div className="mt-6 inline-flex rounded-full border border-brand-navy-900/10 p-1 text-sm">
        <button
          type="button"
          onClick={() => setPeriod("monthly")}
          className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
            period === "monthly" ? "bg-brand-navy-950 text-white" : "text-brand-navy-900/60"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setPeriod("yearly")}
          className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
            period === "yearly" ? "bg-brand-navy-950 text-white" : "text-brand-navy-900/60"
          }`}
        >
          Yearly
        </button>
      </div>

      <p className="mt-6 text-4xl font-semibold text-brand-navy-950">
        {period === "monthly" ? siteConfig.insiderMonthlyPrice : siteConfig.insiderYearlyPrice}
        <span className="text-base font-normal text-brand-navy-900/50">
          /{period === "monthly" ? "mo" : "yr"}
        </span>
      </p>
      {period === "yearly" ? (
        <p className="mt-1 text-sm text-brand-green-600">≈44% off vs. paying monthly</p>
      ) : null}

      <form action={createCheckoutAction.bind(null, productKey)} className="mt-6">
        <Button
          type="submit"
          className="w-full"
          onClick={() => trackClientEvent("Insider checkout started")}
        >
          Get Insider
        </Button>
      </form>
    </div>
  );
}
