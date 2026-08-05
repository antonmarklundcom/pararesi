import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { LeadCaptureForm } from "@/components/marketing/LeadCaptureForm";

export const metadata: Metadata = {
  title: "Paraguay Residency Guide",
  description:
    "An independent, step-by-step information guide to Paraguay residency: paperwork, costs, and timeline — plus a members portal with lessons, templates, and ongoing updates.",
};

const valueProps = [
  {
    title: "Step-by-step, not a wall of forums",
    body: "The paperwork, the order to do it in, and what each step actually costs — organized as a course, not a scattered thread.",
  },
  {
    title: "Stays current",
    body: "Fees and requirements change. Insider members get update posts when something does, instead of finding out at the appointment.",
  },
  {
    title: "Templates included",
    body: "Document checklists and reference templates you can use directly, not just descriptions of what you'll need.",
  },
];

export default function HomePage() {
  return (
    <>
      <Container className="py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-wide text-brand-green-600">
            An independent information guide
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-brand-navy-950 sm:text-5xl">
            A clear, step-by-step path to Paraguay residency.
          </h1>
          <p className="mt-6 text-lg leading-8 text-brand-navy-900/70">
            Everything we could find about the paperwork, costs, and timeline for Paraguay
            residency, organized into one guide — plus a members portal with lesson-by-lesson
            walkthroughs, downloadable templates, and law &amp; fee updates as they happen.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <ButtonLink href="/guide">See what&apos;s inside</ButtonLink>
            <ButtonLink href="/pricing" variant="ghost">
              View pricing
            </ButtonLink>
          </div>
          <p className="mt-6 text-sm text-brand-navy-900/50">
            This is an information product, not legal or immigration advice.{" "}
            <Link href="/about" className="underline hover:text-brand-navy-900">
              Read more
            </Link>
            .
          </p>
        </div>
      </Container>

      <Container className="pb-16">
        <div className="rounded-2xl border border-brand-navy-900/10 bg-brand-green-50 p-8">
          <h2 className="text-2xl font-semibold text-brand-navy-950">
            Get the free Paraguay residency document checklist
          </h2>
          <p className="mt-3 max-w-xl text-brand-navy-900/70">
            Every document you need to gather before you start, in the order you&apos;ll be asked
            for them. Free, by email — no purchase needed.
          </p>
          <LeadCaptureForm source="home-hero" />
        </div>
      </Container>

      <Container className="pb-24">
        <div className="grid gap-8 border-t border-brand-navy-900/10 pt-16 sm:grid-cols-3">
          {valueProps.map((item) => (
            <div key={item.title}>
              <p className="font-semibold text-brand-navy-950">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-brand-navy-900/70">{item.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </>
  );
}
