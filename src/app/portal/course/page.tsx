import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { modules, lessons } from "@/db/schema";
import { requireUser, requireTier } from "@/lib/auth";
import { LockedTeaser } from "@/components/portal/LockedTeaser";

export const metadata: Metadata = {
  title: "Course",
};

export const dynamic = "force-dynamic";

export default async function PortalCourseIndexPage() {
  const user = await requireUser();

  const publishedModules = (await db.select().from(modules).where(eq(modules.status, "published"))).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  const allLessons = await db.select().from(lessons).where(eq(lessons.status, "published"));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">Course</h1>
      <div className="mt-6 space-y-4">
        {publishedModules.length === 0 ? (
          <p className="text-sm text-brand-navy-900/60">No modules published yet.</p>
        ) : (
          await Promise.all(
            publishedModules.map(async (module) => {
              const minTier = module.minTier as "guide" | "insider";
              const unlocked = await requireTier(user, minTier);
              if (!unlocked) {
                return (
                  <LockedTeaser
                    key={module.id}
                    title={module.title}
                    teaser={module.description ?? undefined}
                    requiredTier={minTier}
                  />
                );
              }

              const moduleLessons = allLessons
                .filter((l) => l.moduleId === module.id)
                .sort((a, b) => a.sortOrder - b.sortOrder);

              return (
                <div key={module.id} className="rounded-xl border border-brand-navy-900/10 bg-white p-5">
                  <p className="font-semibold text-brand-navy-950">{module.title}</p>
                  {module.description ? (
                    <p className="mt-1 text-sm text-brand-navy-900/60">{module.description}</p>
                  ) : null}
                  <ul className="mt-3 space-y-1">
                    {moduleLessons.map((lesson) => (
                      <li key={lesson.id}>
                        <Link
                          href={`/portal/course/${module.slug}/${lesson.slug}`}
                          className="text-sm text-brand-green-600 hover:text-brand-green-700"
                        >
                          {lesson.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }),
          )
        )}
      </div>
    </div>
  );
}
