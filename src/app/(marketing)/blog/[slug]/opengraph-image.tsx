import { ImageResponse } from "next/og";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { slug: string } }) {
  const [post] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, params.slug), eq(blogPosts.status, "published")));

  const title = post?.title ?? "Paraguay Residency Guide";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "80px",
          background: "linear-gradient(135deg, #0b1730 0%, #0a1f16 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: 26, color: "#4a9b70", fontWeight: 600, letterSpacing: 2 }}>
          PARAGUAY RESIDENCY GUIDE BLOG
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, marginTop: 24, lineHeight: 1.15, maxWidth: 950 }}>
          {title}
        </div>
      </div>
    ),
    { ...size },
  );
}
