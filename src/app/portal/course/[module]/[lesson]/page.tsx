export default async function LessonPage({
  params,
}: {
  params: Promise<{ module: string; lesson: string }>;
}) {
  const { module, lesson } = await params;
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-primary">
        {module} / {lesson}
      </h1>
      <p className="mt-4 text-muted-foreground">
        [PLACEHOLDER] Server-rendered sanitized markdown lesson content,
        prev/next, mark-complete action. Built in Phase 4.
      </p>
    </div>
  );
}
