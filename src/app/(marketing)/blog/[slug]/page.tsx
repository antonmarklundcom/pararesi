import { Container } from "@/components/ui/Container";

// Fetches a single published blogPosts row by slug in Phase 6.
export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <Container className="py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-brand-navy-950">
        [PLACEHOLDER] Post: {slug}
      </h1>
      <p className="mt-4 max-w-2xl text-brand-navy-900/70">
        Real content, metadata, and Article JSON-LD land in Phase 6.
      </p>
    </Container>
  );
}
