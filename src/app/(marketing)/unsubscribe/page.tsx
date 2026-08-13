import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { unsubscribeLeadByToken } from "@/lib/leads";

export const metadata: Metadata = {
  title: "Unsubscribe",
  // Same reasoning as /subscribe/confirm: only ever rendered for one token.
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

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const lead = token ? await unsubscribeLeadByToken(token) : null;

  if (!lead) {
    return (
      <Shell title="This link didn't work">
        <p>
          We couldn&apos;t match that unsubscribe link to a subscription. If you&apos;re still
          getting emails you don&apos;t want, use the link in the most recent one, or reply to it
          and we&apos;ll remove you by hand.
        </p>
      </Shell>
    );
  }

  return (
    <Shell title="You're unsubscribed">
      <p>
        We&apos;ve removed <span className="text-brand-navy-950">{lead.email}</span> from the
        Paraguay residency email list. You won&apos;t get anything else from us.
      </p>
      <p className="mt-4">
        If this was a mistake, you can sign up again from the{" "}
        <Link href="/" className="text-brand-green-600 hover:underline">
          home page
        </Link>
        .
      </p>
    </Shell>
  );
}
