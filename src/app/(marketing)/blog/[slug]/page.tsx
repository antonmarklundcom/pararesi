export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-3xl font-semibold text-primary">Blog post: {slug}</h1>
      <p className="mt-4 text-muted-foreground">
        [PLACEHOLDER] DB-backed blog post render. Built in Phase 6.
      </p>
    </div>
  );
}
