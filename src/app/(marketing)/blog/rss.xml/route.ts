import { eq, desc } from "drizzle-orm";
import { env } from "@/config/env";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";

const APP_URL = env.appUrl();
const SITE_TITLE = "Paraguay Residency Guide Blog";
const SITE_DESCRIPTION = "Articles on Paraguay residency requirements, costs, and timelines.";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.status, "published"))
    .orderBy(desc(blogPosts.publishedAt));

  const items = posts
    .map((post) => {
      const url = `${APP_URL}/blog/${post.slug}`;
      const pubDate = post.publishedAt ? new Date(post.publishedAt).toUTCString() : undefined;
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ""}
      ${post.excerpt ? `<description>${escapeXml(post.excerpt)}</description>` : ""}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${escapeXml(`${APP_URL}/blog`)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>en-us</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
