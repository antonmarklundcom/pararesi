import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Paraguay Residency Guide.",
};

// Required by Lemon Squeezy as merchant of record. Values come from
// src/config/site.ts — fill in the TODO(owner) fields there before launch.
export default function TermsPage() {
  return (
    <Container className="py-20">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight text-brand-navy-950">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-brand-navy-900/50">
          Last updated: {siteConfig.legalLastUpdated}
        </p>

        <div className="mt-8 space-y-8 text-brand-navy-900/80">
          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">1. Acceptance of terms</h2>
            <p className="mt-2">
              By purchasing or accessing content from Paraguay Residency Guide (&quot;we&quot;,
              &quot;us&quot;), operated by {siteConfig.legalEntityName}, you agree to these
              terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">2. What we sell</h2>
            <p className="mt-2">
              We sell access to an information product (the &quot;Guide&quot; and
              &quot;Insider&quot; membership) describing our understanding of the Paraguay
              residency process. This is educational content, not legal, tax, or immigration
              advice, and not a substitute for consulting a licensed professional. We do not
              guarantee any specific outcome, approval, or timeline.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">3. Payment and merchant of record</h2>
            <p className="mt-2">
              Payments are processed by Lemon Squeezy, who acts as the merchant of record for
              your purchase and handles applicable sales tax/VAT. We never receive or store your
              full card details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">4. Refunds and cancellation</h2>
            <p className="mt-2">
              See our{" "}
              <a href="/refund-policy" className="text-brand-green-600 hover:underline">
                Refund Policy
              </a>{" "}
              for eligibility. Insider is a subscription you can cancel at any time; cancelling
              keeps your access through the end of the period you already paid for — it does not
              trigger an automatic refund.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">5. License to use content</h2>
            <p className="mt-2">
              We grant you a personal, non-transferable license to access the Guide and/or
              Insider content for your own use. Redistribution, resale, or sharing of account
              access is not permitted.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">6. Disclaimer and limitation of liability</h2>
            <p className="mt-2">
              Content is provided &quot;as is&quot; without warranty of any kind. To the maximum
              extent permitted by law, we are not liable for any indirect, incidental, or
              consequential damages arising from your use of this guide or reliance on its
              content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">7. Changes to these terms</h2>
            <p className="mt-2">
              We may update these terms from time to time. Continued use of the site after a
              change constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">8. Contact</h2>
            <p className="mt-2">{siteConfig.contactEmail}</p>
          </section>
        </div>
      </div>
    </Container>
  );
}
