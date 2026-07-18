import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { modules } from "@/db/schema";
import { EntityForm } from "@/components/admin/EntityForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { updateModuleAction, deleteModuleAction } from "../../actions";

export const metadata: Metadata = {
  title: "Admin · Edit module",
};

export const dynamic = "force-dynamic";

export default async function EditModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [module] = await db.select().from(modules).where(eq(modules.id, Number(id)));
  if (!module) notFound();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-navy-950">Edit module</h1>
        <DeleteButton action={deleteModuleAction.bind(null, module.id)} />
      </div>
      <div className="mt-6">
        <EntityForm
          action={updateModuleAction.bind(null, module.id)}
          initialValues={module}
          fields={[
            { type: "text", name: "title", label: "Title", required: true },
            { type: "text", name: "slug", label: "Slug", required: true },
            { type: "textarea", name: "description", label: "Description" },
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
