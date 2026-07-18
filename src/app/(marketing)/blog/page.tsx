import type { Metadata } from "next";
import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Blog",
  description: "Articles on Paraguay residency requirements, costs, and updates.",
};

export const dynamic = "force-dynamic";

export default async function BlogIndexPage() {
  const posts = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.status, "published"))
    .orderBy(desc(blogPosts.publishedAt));

  return (
    <Container className="py-20">
      <h1 className="text-4xl font-semibold tracking-tight text-brand-navy-950">Blog</h1>
      <p className="mt-4 max-w-2xl text-lg text-brand-navy-900/70">
        Articles on Paraguay residency requirements, costs, and timelines.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {posts.length === 0 ? (
          <p className="text-sm text-brand-navy-900/60">No posts published yet.</p>
        ) : (
          posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="block rounded-xl border border-brand-navy-900/10 bg-white p-6 hover:border-brand-green-600/40"
            >
              {post.publishedAt ? (
                <p className="text-xs text-brand-navy-900/50">
                  {new Date(post.publishedAt).toLocaleDateString()}
                </p>
              ) : null}
              <p className="mt-2 font-semibold text-brand-navy-950">{post.title}</p>
              {post.excerpt ? (
                <p className="mt-2 text-sm leading-6 text-brand-navy-900/70">{post.excerpt}</p>
              ) : null}
            </Link>
          ))
        )}
      </div>
    </Container>
  );
}
