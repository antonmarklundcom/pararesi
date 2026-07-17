import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { updatesPosts } from "@/db/schema";
import { EntityForm } from "@/components/admin/EntityForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { updateUpdatesPostAction, deleteUpdatesPostAction } from "../../actions";

export const metadata: Metadata = {
  title: "Admin · Edit update",
};

export const dynamic = "force-dynamic";

export default async function EditUpdatesPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post] = await db.select().from(updatesPosts).where(eq(updatesPosts.id, Number(id)));
  if (!post) notFound();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-navy-950">Edit update</h1>
        <DeleteButton action={deleteUpdatesPostAction.bind(null, post.id)} />
      </div>
      <div className="mt-6">
        <EntityForm
          action={updateUpdatesPostAction.bind(null, post.id)}
          initialValues={post}
          fields={[
            { type: "text", name: "title", label: "Title", required: true },
            { type: "datetime", name: "publishedAt", label: "Published at" },
            {
              type: "select",
              name: "minTier",
              label: "Minimum tier",
              options: [
                { value: "guide", label: "Guide" },
                { value: "insider", label: "Insider" },
              ],
            },
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
