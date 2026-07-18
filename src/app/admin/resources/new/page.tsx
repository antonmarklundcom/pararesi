import type { Metadata } from "next";
import { EntityForm } from "@/components/admin/EntityForm";
import { createResourceAction } from "../actions";

export const metadata: Metadata = {
  title: "Admin · New resource",
};

export default function NewResourcePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">New resource</h1>
      <div className="mt-6">
        <EntityForm
          action={createResourceAction}
          submitLabel="Create resource"
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
