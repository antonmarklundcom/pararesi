import type { MetadataRoute } from "next";
import { env } from "@/config/env";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";

const APP_URL = env.appUrl();

const staticRoutes = ["", "/guide", "/pricing", "/blog", "/about", "/terms", "/privacy", "/refund-policy"];

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = staticRoutes.map((route) => ({
    url: `${APP_URL}${route}`,
    lastModified: new Date(),
  }));

  const posts = await db.select().from(blogPosts).where(eq(blogPosts.status, "published"));
  const blogEntries = posts.map((post) => ({
    url: `${APP_URL}/blog/${post.slug}`,
    lastModified: post.publishedAt ?? new Date(),
  }));

  return [...staticEntries, ...blogEntries];
}
