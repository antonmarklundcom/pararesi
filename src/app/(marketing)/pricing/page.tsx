import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Pricing",
  description: "[PLACEHOLDER] Guide and Insider tier pricing.",
};

export default function PricingPage() {
  return (
    <Container className="py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-brand-navy-950">Pricing</h1>
      <p className="mt-4 max-w-2xl text-brand-navy-900/70">
        [PLACEHOLDER] Guide vs. Insider comparison and monthly/yearly toggle land in Phase 6,
        wired to Lemon Squeezy checkout in Phase 3.
      </p>
    </Container>
  );
}
