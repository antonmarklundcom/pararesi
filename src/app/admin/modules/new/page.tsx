import type { Metadata } from "next";
import { EntityForm } from "@/components/admin/EntityForm";
import { createModuleAction } from "../actions";

export const metadata: Metadata = {
  title: "Admin · New module",
};

export default function NewModulePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">New module</h1>
      <div className="mt-6">
        <EntityForm
          action={createModuleAction}
          submitLabel="Create module"
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
