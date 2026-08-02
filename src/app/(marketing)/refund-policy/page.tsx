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
              If the Guide isn&apos;t useful to you, contact us within{" "}
              <strong>
                {siteConfig.refundWindowDays > 0
                  ? `${siteConfig.refundWindowDays} days`
                  : "[SET REFUND WINDOW]"}
              </strong>{" "}
              of purchase for a full refund. After that window, purchases are final.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">Insider (subscription)</h2>
            <p className="mt-2">
              You can cancel your Insider subscription at any time from your account page.
              Cancelling stops future billing, but you keep access through the end of the period
              you already paid for — cancelling does not itself trigger a refund for the current
              period. If you believe you were charged in error, contact us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">How to request a refund</h2>
            <p className="mt-2">
              Email {siteConfig.contactEmail} with your order number (from your purchase
              receipt). Refunds are processed back to your original payment method by Lemon
              Squeezy, our merchant of record, and typically appear within [PLACEHOLDER —
              e.g. 5–10 business days].
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
