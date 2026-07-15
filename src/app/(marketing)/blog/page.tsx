import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Blog",
  description: "[PLACEHOLDER] Articles on Paraguay residency requirements, costs, and updates.",
};

// DB-backed listing (blogPosts table) is wired up in Phase 6, once Phase 1 schema exists.
export default function BlogIndexPage() {
  return (
    <Container className="py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-brand-navy-950">Blog</h1>
      <p className="mt-4 max-w-2xl text-brand-navy-900/70">
        [PLACEHOLDER] Published posts will list here once the blogPosts table (Phase 1) and
        marketing content pipeline (Phase 6) are built.
      </p>
    </Container>
  );
}
