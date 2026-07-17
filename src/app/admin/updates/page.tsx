import type { Metadata } from "next";
import { db } from "@/db";
import { updatesPosts } from "@/db/schema";
import { DataTable } from "@/components/admin/DataTable";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Admin · Updates",
};

export const dynamic = "force-dynamic";

export default async function AdminUpdatesPage() {
  const rows = await db.select().from(updatesPosts);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-navy-950">Updates</h1>
        <ButtonLink href="/admin/updates/new" className="px-4 py-2 text-sm">
          New update
        </ButtonLink>
      </div>
      <div className="mt-6">
        <DataTable
          rows={rows}
          editHref={(row) => `/admin/updates/${row.id}/edit`}
          columns={[
            { header: "Title", render: (r) => r.title },
            { header: "Min tier", render: (r) => r.minTier },
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
