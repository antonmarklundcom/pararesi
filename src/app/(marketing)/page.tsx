import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";

export default function HomePage() {
  return (
    <Container className="py-24">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-wide text-brand-green-600">
          [PLACEHOLDER] Paraguay Residency Guide
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-brand-navy-950 sm:text-5xl">
          A clear, step-by-step path to Paraguay residency.
        </h1>
        <p className="mt-6 text-lg leading-8 text-brand-navy-900/70">
          [PLACEHOLDER] An independent information guide covering the paperwork, costs, and
          timeline for Paraguay residency — plus an ongoing members portal with lesson-by-lesson
          walkthroughs, downloadable templates, and law &amp; fee updates.
        </p>
        <div className="mt-10 flex gap-4">
          <ButtonLink href="/guide">See what&apos;s inside</ButtonLink>
          <ButtonLink href="/pricing" variant="ghost">
            View pricing
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
