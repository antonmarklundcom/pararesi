import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { modules, lessons, lessonProgress } from "@/db/schema";
import { requireUser, requireTier } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { LockedTeaser } from "@/components/portal/LockedTeaser";
import { toggleLessonComplete } from "./actions";

export const dynamic = "force-dynamic";

type Params = { module: string; lesson: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lesson } = await params;
  return { title: lesson };
}

export default async function LessonPage({ params }: { params: Promise<Params> }) {
  const { module: moduleSlug, lesson: lessonSlug } = await params;
  const user = await requireUser();

  const [module] = await db
    .select()
    .from(modules)
    .where(and(eq(modules.slug, moduleSlug), eq(modules.status, "published")));
  if (!module) notFound();

  const minTier = module.minTier as "guide" | "insider";
  const unlocked = await requireTier(user, minTier);

  if (!unlocked) {
    // Never select contentMd for a locked lesson — only enough to render the teaser.
    const [lessonTitle] = await db
      .select({ title: lessons.title })
      .from(lessons)
      .where(and(eq(lessons.moduleId, module.id), eq(lessons.slug, lessonSlug), eq(lessons.status, "published")));
    if (!lessonTitle) notFound();

    return (
      <div>
        <Link href="/portal/course" className="text-sm text-brand-navy-900/60 hover:text-brand-navy-900">
          &larr; Course
        </Link>
        <div className="mt-4">
          <LockedTeaser
            title={lessonTitle.title}
            teaser={`This lesson is part of the ${minTier === "guide" ? "Guide" : "Insider"} tier.`}
            requiredTier={minTier}
          />
        </div>
      </div>
    );
  }

  const [lesson] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.moduleId, module.id), eq(lessons.slug, lessonSlug), eq(lessons.status, "published")));
  if (!lesson) notFound();

  const moduleLessons = (
    await db.select().from(lessons).where(and(eq(lessons.moduleId, module.id), eq(lessons.status, "published")))
  ).sort((a, b) => a.sortOrder - b.sortOrder);

  const currentIndex = moduleLessons.findIndex((l) => l.id === lesson.id);
  const prevLesson = currentIndex > 0 ? moduleLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < moduleLessons.length - 1 ? moduleLessons[currentIndex + 1] : null;

  const [progress] = await db
    .select()
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, user.id), eq(lessonProgress.lessonId, lesson.id)));

  const modulePath = `/portal/course/${module.slug}/${lesson.slug}`;
  const html = renderMarkdown(lesson.contentMd);

  return (
    <div className="max-w-2xl">
      <Link href="/portal/course" className="text-sm text-brand-navy-900/60 hover:text-brand-navy-900">
        &larr; Course
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-brand-navy-950">{lesson.title}</h1>

      {lesson.videoUrl ? (
        <div className="mt-4 aspect-video overflow-hidden rounded-xl bg-black">
          <iframe
            src={lesson.videoUrl}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null}

      <div
        className="prose prose-sm mt-6 max-w-none text-brand-navy-900/80"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <form action={toggleLessonComplete.bind(null, lesson.id, modulePath)} className="mt-6">
        <button
          type="submit"
          className={`rounded-full px-5 py-2 text-sm font-medium ${
            progress
              ? "bg-brand-green-50 text-brand-green-700"
              : "bg-brand-green-600 text-white hover:bg-brand-green-700"
          }`}
        >
          {progress ? "Completed ✓" : "Mark as complete"}
        </button>
      </form>

      <div className="mt-8 flex justify-between border-t border-brand-navy-900/10 pt-4 text-sm">
        {prevLesson ? (
          <Link
            href={`/portal/course/${module.slug}/${prevLesson.slug}`}
            className="text-brand-green-600 hover:text-brand-green-700"
          >
            &larr; {prevLesson.title}
          </Link>
        ) : (
          <span />
        )}
        {nextLesson ? (
          <Link
            href={`/portal/course/${module.slug}/${nextLesson.slug}`}
            className="text-brand-green-600 hover:text-brand-green-700"
          >
            {nextLesson.title} &rarr;
          </Link>
        ) : null}
      </div>
    </div>
  );
}
