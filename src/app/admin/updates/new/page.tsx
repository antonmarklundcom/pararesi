import type { Metadata } from "next";
import { EntityForm } from "@/components/admin/EntityForm";
import { createUpdatesPostAction } from "../actions";

export const metadata: Metadata = {
  title: "Admin · New update",
};

export default function NewUpdatesPostPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">New update</h1>
      <div className="mt-6">
        <EntityForm
          action={createUpdatesPostAction}
          submitLabel="Create update"
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
