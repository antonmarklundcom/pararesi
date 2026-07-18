import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { Container } from "@/components/ui/Container";
import { renderMarkdown } from "@/lib/markdown";
import { articleJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

async function getPost(slug: string) {
  const [post] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, "published")));
  return post ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post not found" };

  return {
    title: post.metaTitle ?? post.title,
    description: post.metaDescription ?? post.excerpt ?? undefined,
    openGraph: {
      title: post.metaTitle ?? post.title,
      description: post.metaDescription ?? post.excerpt ?? undefined,
      type: "article",
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <Container className="py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            articleJsonLd({
              headline: post.title,
              description: post.excerpt ?? post.metaDescription ?? "",
              url: `/blog/${post.slug}`,
              datePublished: post.publishedAt ? new Date(post.publishedAt).toISOString() : null,
            }),
          ),
        }}
      />
      <article className="mx-auto max-w-2xl">
        {post.publishedAt ? (
          <p className="text-sm text-brand-navy-900/50">
            {new Date(post.publishedAt).toLocaleDateString()}
          </p>
        ) : null}
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-navy-950 sm:text-4xl">
          {post.title}
        </h1>
        <div
          className="prose prose-sm mt-8 max-w-none text-brand-navy-900/80"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.contentMd) }}
        />
      </article>
    </Container>
  );
}
