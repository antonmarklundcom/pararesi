import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { resources } from "@/db/schema";
import { requireUser, effectiveTier, TIER_RANK } from "@/lib/auth";
import { LockedTeaser } from "@/components/portal/LockedTeaser";

export const metadata: Metadata = {
  title: "Resources",
};

export const dynamic = "force-dynamic";

export default async function PortalResourcesPage() {
  const user = await requireUser();
  const tier = await effectiveTier(user);

  const publishedResources = (
    await db.select().from(resources).where(eq(resources.status, "published"))
  ).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">Resources</h1>
      <div className="mt-6 space-y-3">
        {publishedResources.length === 0 ? (
          <p className="text-sm text-brand-navy-900/60">No resources published yet.</p>
        ) : (
          publishedResources.map((resource) => {
            const unlocked = TIER_RANK[tier] >= TIER_RANK[resource.minTier as "guide" | "insider"];
            if (!unlocked) {
              return (
                <LockedTeaser key={resource.id} title={resource.title} teaser={resource.description ?? undefined} />
              );
            }
            return (
              <a
                key={resource.id}
                href={resource.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-brand-navy-900/10 bg-white p-4 hover:border-brand-green-600/40"
              >
                <p className="font-medium text-brand-navy-950">{resource.title}</p>
                {resource.description ? (
                  <p className="mt-1 text-sm text-brand-navy-900/60">{resource.description}</p>
                ) : null}
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
