import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "About",
  description: "[PLACEHOLDER] About Paraguay Residency Guide.",
};

export default function AboutPage() {
  return (
    <Container className="py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-brand-navy-950">About</h1>
      <p className="mt-4 max-w-2xl text-brand-navy-900/70">[PLACEHOLDER — owner to replace]</p>
    </Container>
  );
}
