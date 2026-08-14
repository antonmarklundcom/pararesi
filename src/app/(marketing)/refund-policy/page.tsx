import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Refund Policy for Paraguay Residency Guide.",
};

// Required by Lemon Squeezy as merchant of record. Must match what LS is told
// during store setup (docs/04 §3). Values come from src/config/site.ts — fill
// in the TODO(owner) fields there before launch.
export default function RefundPolicyPage() {
  return (
    <Container className="py-20">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight text-brand-navy-950">
          Refund Policy
        </h1>
        <p className="mt-2 text-sm text-brand-navy-900/50">
          Last updated: {siteConfig.legalLastUpdated}
        </p>

        <div className="mt-8 space-y-8 text-brand-navy-900/80">
          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">The Guide (one-time purchase)</h2>
            <p className="mt-2">
              All Guide purchases are <strong>final sale</strong>. Because you get instant, full
              access to the entire course the moment you buy, we don&apos;t offer refunds once a
              purchase is complete. Please review the guide contents and FAQ before buying if
              you&apos;re unsure whether it&apos;s right for you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">Insider (subscription)</h2>
            <p className="mt-2">
              You can cancel your Insider subscription at any time from your account page.
              Cancelling stops future billing, but you keep access through the end of the period
              you already paid for — cancelling does not itself trigger a refund for the current
              period, and past subscription charges are likewise final.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">Not covered</h2>
            <p className="mt-2">
              Refunds do not cover dissatisfaction with residency requirements, fees, or
              timelines set by government authorities — those are outside our control and not
              guaranteed by this guide.
            </p>
          </section>
        </div>
      </div>
    </Container>
  );
}
