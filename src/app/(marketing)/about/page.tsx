import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "About",
  description: "About Paraguay Residency Guide.",
};

export default function AboutPage() {
  return (
    <Container className="py-20">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight text-brand-navy-950">About</h1>
        <div className="mt-6 space-y-4 text-brand-navy-900/80">
          <p>[PLACEHOLDER — owner to replace with the real story: who built this guide and why.]</p>
          <p>
            Paraguay Residency Guide is an independent information product. We are not a law
            firm, a licensed immigration consultancy, or a government body, and nothing on this
            site is legal, tax, or immigration advice. We share our understanding of the general
            residency process based on research and experience, but requirements change and
            individual situations vary — for advice specific to your case, consult a licensed
            professional in Paraguay.
          </p>
          <p>
            We make no guarantee of any specific outcome, approval, or timeline. Purchasing this
            guide does not create an attorney-client or advisory relationship of any kind.
          </p>
        </div>
      </div>
    </Container>
  );
}
