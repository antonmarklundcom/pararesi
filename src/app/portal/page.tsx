import type { Metadata } from "next";
import Link from "next/link";
import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { modules, lessons, lessonProgress, updatesPosts } from "@/db/schema";
import { requireUser, effectiveTier, TIER_RANK } from "@/lib/auth";
import { LockedTeaser } from "@/components/portal/LockedTeaser";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

export default async function PortalDashboardPage() {
  const user = await requireUser();
  const tier = await effectiveTier(user);

  const accessibleModules = (await db.select().from(modules).where(eq(modules.status, "published"))).filter(
    (m) => TIER_RANK[tier] >= TIER_RANK[m.minTier as "guide" | "insider"],
  );

  const accessibleModuleIds = accessibleModules.map((m) => m.id);
  const accessibleLessons = accessibleModuleIds.length
    ? await db
        .select()
        .from(lessons)
        .where(and(eq(lessons.status, "published"), inArray(lessons.moduleId, accessibleModuleIds)))
    : [];

  const completedRows = accessibleLessons.length
    ? await db
        .select()
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.userId, user.id),
            inArray(
              lessonProgress.lessonId,
              accessibleLessons.map((l) => l.id),
            ),
          ),
        )
    : [];
  const completedLessonIds = new Set(completedRows.map((r) => r.lessonId));

  const sortedLessons = [...accessibleLessons].sort((a, b) => {
    const moduleOrderA = accessibleModules.find((m) => m.id === a.moduleId)?.sortOrder ?? 0;
    const moduleOrderB = accessibleModules.find((m) => m.id === b.moduleId)?.sortOrder ?? 0;
    return moduleOrderA - moduleOrderB || a.sortOrder - b.sortOrder;
  });
  const nextLesson = sortedLessons.find((l) => !completedLessonIds.has(l.id)) ?? sortedLessons[0];
  const nextLessonModule = nextLesson ? accessibleModules.find((m) => m.id === nextLesson.moduleId) : undefined;

  const progressPct = sortedLessons.length
    ? Math.round((completedLessonIds.size / sortedLessons.length) * 100)
    : 0;

  const latestUpdates = await db
    .select()
    .from(updatesPosts)
    .where(eq(updatesPosts.status, "published"))
    .orderBy(desc(updatesPosts.publishedAt))
    .limit(3);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-brand-navy-950">Dashboard</h1>
        <p className="mt-1 text-sm text-brand-navy-900/60">Welcome back{user.name ? `, ${user.name}` : ""}.</p>
      </div>

      <div className="rounded-xl border border-brand-navy-900/10 bg-white p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-brand-navy-900">Course progress</p>
          <p className="text-sm text-brand-navy-900/60">
            {completedLessonIds.size}/{sortedLessons.length} lessons ({progressPct}%)
          </p>
        </div>
        <div className="mt-3 h-2 rounded-full bg-brand-green-50">
          <div className="h-2 rounded-full bg-brand-green-600" style={{ width: `${progressPct}%` }} />
        </div>
        {nextLesson && nextLessonModule ? (
          <Link
            href={`/portal/course/${nextLessonModule.slug}/${nextLesson.slug}`}
            className="mt-4 inline-block text-sm font-medium text-brand-green-600 hover:text-brand-green-700"
          >
            Continue: {nextLesson.title} &rarr;
          </Link>
        ) : (
          <p className="mt-4 text-sm text-brand-navy-900/60">No lessons available yet.</p>
        )}
      </div>

      {tier === "guide" ? (
        <LockedTeaser
          title="Unlock the full Insider curriculum"
          teaser="Advanced modules, templates, and the ongoing law & fee updates feed."
        />
      ) : null}

      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-brand-navy-900">Latest updates</p>
          <Link href="/portal/updates" className="text-sm text-brand-green-600 hover:text-brand-green-700">
            View all
          </Link>
        </div>
        <div className="mt-3 space-y-3">
          {latestUpdates.length === 0 ? (
            <p className="text-sm text-brand-navy-900/60">No updates yet.</p>
          ) : (
            latestUpdates.map((post) =>
              TIER_RANK[tier] >= TIER_RANK[post.minTier as "guide" | "insider"] ? (
                <div key={post.id} className="rounded-xl border border-brand-navy-900/10 bg-white p-4">
                  <p className="font-medium text-brand-navy-950">{post.title}</p>
                  <p className="mt-1 text-xs text-brand-navy-900/50">
                    {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ""}
                  </p>
                </div>
              ) : (
                <LockedTeaser key={post.id} title={post.title} />
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
}
