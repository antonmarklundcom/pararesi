import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "[PLACEHOLDER] Refund Policy for Paraguay Residency Guide.",
};

// Required by Lemon Squeezy as merchant of record. Must match what LS is told
// during store setup — finalize alongside docs/05 decisions before launch.
export default function RefundPolicyPage() {
  return (
    <Container className="py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-brand-navy-950">
        Refund Policy
      </h1>
      <p className="mt-4 max-w-2xl text-brand-navy-900/70">[PLACEHOLDER — owner to replace]</p>
    </Container>
  );
}
