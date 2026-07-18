import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { modules, lessons } from "@/db/schema";
import { EntityForm } from "@/components/admin/EntityForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { updateLessonAction, deleteLessonAction } from "../../actions";

export const metadata: Metadata = {
  title: "Admin · Edit lesson",
};

export const dynamic = "force-dynamic";

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = await params;
  const moduleId = Number(id);
  const [module] = await db.select().from(modules).where(eq(modules.id, moduleId));
  if (!module) notFound();

  const [lesson] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.id, Number(lessonId)), eq(lessons.moduleId, moduleId)));
  if (!lesson) notFound();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-navy-950">
          Edit lesson — {module.title}
        </h1>
        <DeleteButton action={deleteLessonAction.bind(null, moduleId, lesson.id)} />
      </div>
      <div className="mt-6">
        <EntityForm
          action={updateLessonAction.bind(null, moduleId, lesson.id)}
          initialValues={lesson}
          fields={[
            { type: "text", name: "title", label: "Title", required: true },
            { type: "text", name: "slug", label: "Slug", required: true },
            { type: "text", name: "videoUrl", label: "Video URL (optional)" },
            { type: "number", name: "sortOrder", label: "Sort order" },
            {
              type: "select",
              name: "status",
              label: "Status",
              options: [
                { value: "draft", label: "Draft" },
                { value: "published", label: "Published" },
              ],
            },
            { type: "markdown", name: "contentMd", label: "Content (Markdown)" },
          ]}
        />
      </div>
    </div>
  );
}
