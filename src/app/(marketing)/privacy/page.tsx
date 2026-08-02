import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Paraguay Residency Guide.",
};

// Required by Lemon Squeezy as merchant of record. Values come from
// src/config/site.ts — fill in the TODO(owner) fields there before launch.
export default function PrivacyPage() {
  return (
    <Container className="py-20">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight text-brand-navy-950">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-brand-navy-900/50">
          Last updated: {siteConfig.legalLastUpdated}
        </p>

        <div className="mt-8 space-y-8 text-brand-navy-900/80">
          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">What we collect</h2>
            <p className="mt-2">
              Your email address and name (when you provide it), your purchase and subscription
              status, and any content you save inside the members portal (e.g. lesson progress).
              We do not collect or store payment card details — those are handled entirely by
              Lemon Squeezy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">How we use it</h2>
            <p className="mt-2">
              To create and manage your account, deliver purchased content, send
              transactional emails (purchase receipts, password reset links, update
              notifications for Insider members), and improve the guide.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">Third-party services</h2>
            <p className="mt-2">
              We use Lemon Squeezy for payment processing (as merchant of record), Resend for
              transactional email delivery, and Plausible for privacy-friendly, cookieless site
              analytics. Each has its own privacy policy governing how they handle your data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">Cookies</h2>
            <p className="mt-2">
              We use a single essential cookie to keep you logged in to the members portal. Our
              site analytics (Plausible) is cookieless and does not track you individually across
              sites, so we do not show a cookie consent banner.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">Data retention</h2>
            <p className="mt-2">
              We retain account data for as long as your account is active, plus a reasonable
              period afterward for tax and dispute-resolution purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">Your rights</h2>
            <p className="mt-2">
              You can request a copy of your data or ask us to delete your account by contacting
              us. [PLACEHOLDER — add specific GDPR/CCPA language if applicable to your buyer
              base.]
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-brand-navy-950">Contact</h2>
            <p className="mt-2">{siteConfig.contactEmail}</p>
          </section>
        </div>
      </div>
    </Container>
  );
}
