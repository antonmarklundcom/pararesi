import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "The Guide",
  description: "[PLACEHOLDER] The Paraguay Residency Guide — what's inside, curriculum, and pricing.",
};

// Full long-form sales page (problem -> curriculum -> pricing -> FAQ -> guarantee)
// is built in Phase 6 per docs/03-build-guide.md. This is a structural placeholder.
export default function GuidePage() {
  return (
    <Container className="py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-brand-navy-950">
        [PLACEHOLDER] The Paraguay Residency Guide
      </h1>
      <p className="mt-4 max-w-2xl text-brand-navy-900/70">
        Sales page sections (problem, what&apos;s inside, curriculum preview, pricing, FAQ,
        guarantee) land in Phase 6.
      </p>
      <div className="mt-8">
        <ButtonLink href="/pricing">See pricing</ButtonLink>
      </div>
    </Container>
  );
}
