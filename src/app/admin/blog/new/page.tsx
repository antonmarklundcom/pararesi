import type { Metadata } from "next";
import { EntityForm } from "@/components/admin/EntityForm";
import { createBlogPostAction } from "../actions";

export const metadata: Metadata = {
  title: "Admin · New blog post",
};

export default function NewBlogPostPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">New blog post</h1>
      <div className="mt-6">
        <EntityForm
          action={createBlogPostAction}
          submitLabel="Create post"
          fields={[
            { type: "text", name: "title", label: "Title", required: true },
            { type: "text", name: "slug", label: "Slug", required: true },
            { type: "textarea", name: "excerpt", label: "Excerpt" },
            { type: "text", name: "metaTitle", label: "Meta title" },
            { type: "textarea", name: "metaDescription", label: "Meta description" },
            { type: "datetime", name: "publishedAt", label: "Published at" },
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
