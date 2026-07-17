import type { Metadata } from "next";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { DataTable } from "@/components/admin/DataTable";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Admin · Blog",
};

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const rows = await db.select().from(blogPosts);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-navy-950">Blog</h1>
        <ButtonLink href="/admin/blog/new" className="px-4 py-2 text-sm">
          New post
        </ButtonLink>
      </div>
      <div className="mt-6">
        <DataTable
          rows={rows}
          editHref={(row) => `/admin/blog/${row.id}/edit`}
          columns={[
            { header: "Title", render: (r) => r.title },
            { header: "Slug", render: (r) => r.slug },
            { header: "Status", render: (r) => r.status },
            {
              header: "Published",
              render: (r) => (r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : "—"),
            },
          ]}
        />
      </div>
    </div>
  );
}
