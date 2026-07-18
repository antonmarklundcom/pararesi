import type { Metadata } from "next";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { updatesPosts } from "@/db/schema";
import { requireUser, effectiveTier, TIER_RANK } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { LockedTeaser } from "@/components/portal/LockedTeaser";

export const metadata: Metadata = {
  title: "Updates",
};

export const dynamic = "force-dynamic";

export default async function PortalUpdatesPage() {
  const user = await requireUser();
  const tier = await effectiveTier(user);

  const publishedUpdates = await db
    .select()
    .from(updatesPosts)
    .where(eq(updatesPosts.status, "published"))
    .orderBy(desc(updatesPosts.publishedAt));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">Updates</h1>
      <p className="mt-1 text-sm text-brand-navy-900/60">Law &amp; fee changes as they happen.</p>
      <div className="mt-6 space-y-4">
        {publishedUpdates.length === 0 ? (
          <p className="text-sm text-brand-navy-900/60">No updates yet.</p>
        ) : (
          publishedUpdates.map((post) => {
            const unlocked = TIER_RANK[tier] >= TIER_RANK[post.minTier as "guide" | "insider"];
            if (!unlocked) {
              return <LockedTeaser key={post.id} title={post.title} />;
            }
            return (
              <div key={post.id} className="rounded-xl border border-brand-navy-900/10 bg-white p-5">
                <p className="text-xs text-brand-navy-900/50">
                  {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ""}
                </p>
                <p className="mt-1 font-semibold text-brand-navy-950">{post.title}</p>
                <div
                  className="prose prose-sm mt-2 max-w-none text-brand-navy-900/80"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(post.contentMd) }}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
