import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { modules } from "@/db/schema";
import { EntityForm } from "@/components/admin/EntityForm";
import { createLessonAction } from "../actions";

export const metadata: Metadata = {
  title: "Admin · New lesson",
};

export const dynamic = "force-dynamic";

export default async function NewLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const moduleId = Number(id);
  const [module] = await db.select().from(modules).where(eq(modules.id, moduleId));
  if (!module) notFound();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">New lesson — {module.title}</h1>
      <div className="mt-6">
        <EntityForm
          action={createLessonAction.bind(null, moduleId)}
          submitLabel="Create lesson"
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
