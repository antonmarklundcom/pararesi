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
          <p>
            I&apos;m Anton — a 34-year-old Swede who moved to Paraguay about two years ago. I came
            for the tax benefits, plain and simple. I stayed for everything else: the food, the
            people, the pace of life, and honestly, this is also where I met my girlfriend.
          </p>
          <p>
            Getting residency here taught me a lot — mostly by figuring things out the hard way,
            asking around, and making mistakes I wish someone had warned me about. This guide is
            the resource I wish I&apos;d had when I started.
          </p>
          <p>
            What I&apos;m building now is bigger than the paperwork. I want to bring together a
            community of like-minded people focused on business, family, health, and personal
            growth — people who are intentional about how and where they live. Paraguay residency
            is just the starting point.
          </p>
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
