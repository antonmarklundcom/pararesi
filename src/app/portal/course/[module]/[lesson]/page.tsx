import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lesson",
};

// Server-rendered sanitized markdown + requireTier gate + locked-teaser upsell
// for insider content land in Phase 4. Never fetch lesson content client-side.
export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ module: string; lesson: string }>;
}) {
  const { module: moduleSlug, lesson: lessonSlug } = await params;
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">
        [PLACEHOLDER] {moduleSlug} / {lessonSlug}
      </h1>
      <p className="mt-2 text-sm text-brand-navy-900/60">
        Lesson content, progress toggle, and tier gating land in Phase 4.
      </p>
    </div>
  );
}
