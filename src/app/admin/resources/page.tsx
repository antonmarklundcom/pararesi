import type { Metadata } from "next";
import { db } from "@/db";
import { resources } from "@/db/schema";
import { DataTable } from "@/components/admin/DataTable";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Admin · Resources",
};

export const dynamic = "force-dynamic";

export default async function AdminResourcesPage() {
  const rows = (await db.select().from(resources)).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-navy-950">Resources</h1>
        <ButtonLink href="/admin/resources/new" className="px-4 py-2 text-sm">
          New resource
        </ButtonLink>
      </div>
      <div className="mt-6">
        <DataTable
          rows={rows}
          editHref={(row) => `/admin/resources/${row.id}/edit`}
          columns={[
            { header: "Title", render: (r) => r.title },
            { header: "Min tier", render: (r) => r.minTier },
            { header: "Status", render: (r) => r.status },
            { header: "Order", render: (r) => r.sortOrder },
          ]}
        />
      </div>
    </div>
  );
}
