import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { confirmLeadByToken } from "@/lib/leads";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Confirm your email",
  // Not a page worth indexing, and it only ever renders for one token.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Container className="py-24">
      <div className="max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight text-brand-navy-950">{title}</h1>
        <div className="mt-4 text-brand-navy-900/70">{children}</div>
      </div>
    </Container>
  );
}

export default async function ConfirmSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const lead = token ? await confirmLeadByToken(token) : null;

  if (!lead) {
    return (
      <Shell title="This link didn't work">
        <p>
          Confirmation links are single-use and expire after 7 days. Ask for a new one from the{" "}
          <Link href="/" className="text-brand-green-600 hover:underline">
            home page
          </Link>{" "}
          and we&apos;ll send a fresh link.
        </p>
      </Shell>
    );
  }

  const checklistUrl = siteConfig.leadMagnetChecklistUrl;

  return (
    <Shell title="You're confirmed">
      {checklistUrl ? (
        <>
          <p>
            Thanks — your email is confirmed. Here&apos;s your Paraguay residency document
            checklist:
          </p>
          <p className="mt-4">
            <a
              href={checklistUrl}
              className="inline-flex items-center rounded-full bg-brand-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-brand-green-700"
            >
              Download the checklist
            </a>
          </p>
          <p className="mt-4 text-sm">
            We&apos;ll also send the occasional update when requirements or fees change.
          </p>
        </>
      ) : (
        // No checklist file wired up yet (siteConfig.leadMagnetChecklistUrl is
        // still null) — say something true instead of promising a download.
        <p>
          Thanks — your email is confirmed. We&apos;ll be in touch with the Paraguay residency
          document checklist, plus the occasional update when requirements or fees change.
        </p>
      )}
      <p className="mt-4">
        If you&apos;d rather not wait,{" "}
        <Link href="/guide" className="text-brand-green-600 hover:underline">
          see what&apos;s inside the full guide
        </Link>
        .
      </p>
    </Shell>
  );
}
