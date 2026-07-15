import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "[PLACEHOLDER] Terms of Service for Paraguay Residency Guide.",
};

// Required by Lemon Squeezy as merchant of record. Real copy landed in Phase 6/9.
export default function TermsPage() {
  return (
    <Container className="py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-brand-navy-950">
        Terms of Service
      </h1>
      <p className="mt-4 max-w-2xl text-brand-navy-900/70">[PLACEHOLDER — owner to replace]</p>
    </Container>
  );
}
