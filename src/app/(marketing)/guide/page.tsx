import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { modules, lessons } from "@/db/schema";
import { Container } from "@/components/ui/Container";
import { BuyButton } from "@/components/marketing/BuyButton";
import { Faq } from "@/components/marketing/Faq";
import { productJsonLd, faqPageJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

const TITLE = "The Paraguay Residency Guide";
const DESCRIPTION =
  "A step-by-step information guide to Paraguay residency: paperwork, costs, and timeline, organized into one course — plus lifetime access to the members portal.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website" },
};

const problems = [
  "Forum threads that contradict each other, with no way to tell what's current.",
  "No clear order of operations — which document first, which office, which appointment.",
  "No idea what it actually costs until you're already partway through.",
];

const whatsInside = [
  "A lesson-by-lesson walkthrough of the residency process, from start to filing.",
  "A document checklist you can follow directly instead of re-deriving from forum posts.",
  "A cost and timeline breakdown so there are no surprises partway through.",
  "Lifetime access to the members portal — content updates don't cost extra.",
];

const faqItems = [
  {
    question: "Is this legal or immigration advice?",
    answer:
      "No. This is an independent information product describing our understanding of the general process. It is not legal, immigration, or tax advice, and we make no guarantee of any specific outcome or timeline. For advice specific to your situation, consult a licensed professional.",
  },
  {
    question: "What's the difference between the Guide and Insider?",
    answer:
      "The Guide is a one-time purchase with lifetime access to the core course and templates. Insider is a subscription that includes everything in the Guide plus advanced modules, additional templates, and an ongoing feed of law and fee updates as they happen.",
  },
  {
    question: "How is this kept current?",
    answer:
      "Requirements and fees change from time to time. Insider members get update posts when we become aware of a change, instead of finding out at the appointment.",
  },
  {
    question: "What if it's not useful to me?",
    answer: "See our refund policy for the details on eligibility and how to request one.",
  },
  {
    question: "How do I pay, and is it secure?",
    answer:
      "Checkout is handled by Lemon Squeezy, our payment processor and merchant of record. We never see or store your card details.",
  },
];

export default async function GuidePage() {
  const guideModules = (
    await db
      .select()
      .from(modules)
      .where(eq(modules.status, "published"))
  )
    .filter((m) => m.minTier === "guide")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const allLessons = await db.select().from(lessons).where(eq(lessons.status, "published"));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd({ name: TITLE, description: DESCRIPTION, url: "/guide" })),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd(faqItems)) }}
      />

      {/* Hero */}
      <Container className="py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-wide text-brand-green-600">
            The Guide — one-time purchase, lifetime access
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-brand-navy-950 sm:text-5xl">
            {TITLE}
          </h1>
          <p className="mt-6 text-lg leading-8 text-brand-navy-900/70">{DESCRIPTION}</p>
          <div className="mt-10 max-w-xs">
            <BuyButton productKey="guide">Get the Guide — [PLACEHOLDER price]</BuyButton>
            <p className="mt-3 text-center text-xs text-brand-navy-900/50">
              One-time payment. See{" "}
              <Link href="/refund-policy" className="underline hover:text-brand-navy-900">
                refund policy
              </Link>
              .
            </p>
          </div>
        </div>
      </Container>

      {/* Problem */}
      <Container className="py-16">
        <div className="border-t border-brand-navy-900/10 pt-16">
          <h2 className="text-2xl font-semibold text-brand-navy-950">
            Researching this alone is the hard part.
          </h2>
          <ul className="mt-6 max-w-2xl space-y-3">
            {problems.map((p) => (
              <li key={p} className="flex gap-3 text-brand-navy-900/70">
                <span className="text-brand-green-600">—</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      {/* What's inside */}
      <Container className="py-16">
        <div className="border-t border-brand-navy-900/10 pt-16">
          <h2 className="text-2xl font-semibold text-brand-navy-950">What&apos;s inside</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {whatsInside.map((item) => (
              <div key={item} className="rounded-xl border border-brand-navy-900/10 bg-white p-5">
                <p className="text-sm leading-6 text-brand-navy-900/80">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>

      {/* Curriculum preview */}
      {guideModules.length > 0 ? (
        <Container className="py-16">
          <div className="border-t border-brand-navy-900/10 pt-16">
            <h2 className="text-2xl font-semibold text-brand-navy-950">Curriculum preview</h2>
            <div className="mt-6 space-y-4">
              {guideModules.map((module) => {
                const moduleLessons = allLessons
                  .filter((l) => l.moduleId === module.id)
                  .sort((a, b) => a.sortOrder - b.sortOrder);
                return (
                  <div key={module.id} className="rounded-xl border border-brand-navy-900/10 bg-white p-5">
                    <p className="font-semibold text-brand-navy-950">{module.title}</p>
                    {module.description ? (
                      <p className="mt-1 text-sm text-brand-navy-900/60">{module.description}</p>
                    ) : null}
                    {moduleLessons.length > 0 ? (
                      <ul className="mt-3 space-y-1 text-sm text-brand-navy-900/70">
                        {moduleLessons.map((lesson) => (
                          <li key={lesson.id}>{lesson.title}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </Container>
      ) : null}

      {/* Pricing */}
      <Container className="py-16">
        <div className="border-t border-brand-navy-900/10 pt-16">
          <h2 className="text-2xl font-semibold text-brand-navy-950">Pricing</h2>
          <p className="mt-4 max-w-2xl text-brand-navy-900/70">
            The Guide is a one-time purchase with lifetime access. Want the advanced modules and
            ongoing updates too?{" "}
            <Link href="/pricing" className="text-brand-green-600 hover:underline">
              See the full comparison with Insider
            </Link>
            .
          </p>
        </div>
      </Container>

      {/* FAQ */}
      <Container className="py-16">
        <div className="border-t border-brand-navy-900/10 pt-16">
          <h2 className="text-2xl font-semibold text-brand-navy-950">Frequently asked questions</h2>
          <div className="mt-6">
            <Faq items={faqItems} />
          </div>
        </div>
      </Container>

      {/* Final CTA */}
      <Container className="py-16 pb-24">
        <div className="rounded-2xl bg-brand-navy-950 px-8 py-12 text-center">
          <h2 className="text-2xl font-semibold text-white">Ready to get started?</h2>
          <div className="mx-auto mt-6 max-w-xs">
            <BuyButton productKey="guide">Get the Guide — [PLACEHOLDER price]</BuyButton>
          </div>
        </div>
      </Container>
    </>
  );
}
