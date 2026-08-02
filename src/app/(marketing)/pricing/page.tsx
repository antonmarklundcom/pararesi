import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { BuyButton } from "@/components/marketing/BuyButton";
import { InsiderPricingCard } from "./InsiderPricingCard";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Guide vs. Insider pricing for the Paraguay Residency Guide.",
};

export default function PricingPage() {
  return (
    <Container className="py-20">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight text-brand-navy-950">Pricing</h1>
        <p className="mt-4 text-lg text-brand-navy-900/70">
          Start with the Guide for the core course, or go Insider for everything plus ongoing
          updates.
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-brand-navy-900/10 bg-white p-8">
          <h3 className="text-xl font-semibold text-brand-navy-950">Guide</h3>
          <p className="mt-2 text-sm text-brand-navy-900/60">
            The core step-by-step course, document checklist, and cost/timeline breakdown.
            One-time purchase, lifetime access.
          </p>
          <p className="mt-6 text-4xl font-semibold text-brand-navy-950">{siteConfig.guidePrice}</p>
          <p className="mt-1 text-sm text-brand-navy-900/50">one-time payment</p>
          <div className="mt-6">
            <BuyButton productKey="guide" variant="secondary">
              Get the Guide
            </BuyButton>
          </div>
        </div>

        <InsiderPricingCard />
      </div>

      <p className="mt-10 max-w-2xl text-sm text-brand-navy-900/50">
        Checkout is handled by Lemon Squeezy, our merchant of record. See our{" "}
        <Link href="/refund-policy" className="underline hover:text-brand-navy-900">
          refund policy
        </Link>{" "}
        for eligibility details.
      </p>
    </Container>
  );
}
