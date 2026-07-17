import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { resources } from "@/db/schema";
import { EntityForm } from "@/components/admin/EntityForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { updateResourceAction, deleteResourceAction } from "../../actions";

export const metadata: Metadata = {
  title: "Admin · Edit resource",
};

export const dynamic = "force-dynamic";

export default async function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [resource] = await db.select().from(resources).where(eq(resources.id, Number(id)));
  if (!resource) notFound();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-navy-950">Edit resource</h1>
        <DeleteButton action={deleteResourceAction.bind(null, resource.id)} />
      </div>
      <div className="mt-6">
        <EntityForm
          action={updateResourceAction.bind(null, resource.id)}
          initialValues={resource}
          fields={[
            { type: "text", name: "title", label: "Title", required: true },
            { type: "textarea", name: "description", label: "Description" },
            { type: "text", name: "fileUrl", label: "File URL", required: true },
            { type: "number", name: "sortOrder", label: "Sort order" },
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
          ]}
        />
      </div>
    </div>
  );
}
