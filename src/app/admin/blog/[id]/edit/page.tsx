import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { EntityForm } from "@/components/admin/EntityForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { updateBlogPostAction, deleteBlogPostAction } from "../../actions";

export const metadata: Metadata = {
  title: "Admin · Edit blog post",
};

export const dynamic = "force-dynamic";

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, Number(id)));
  if (!post) notFound();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-navy-950">Edit blog post</h1>
        <DeleteButton action={deleteBlogPostAction.bind(null, post.id)} />
      </div>
      <div className="mt-6">
        <EntityForm
          action={updateBlogPostAction.bind(null, post.id)}
          initialValues={post}
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
