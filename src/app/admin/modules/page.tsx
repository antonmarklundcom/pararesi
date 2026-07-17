import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { modules } from "@/db/schema";
import { DataTable } from "@/components/admin/DataTable";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Admin · Modules",
};

export const dynamic = "force-dynamic";

export default async function AdminModulesPage() {
  const rows = (await db.select().from(modules)).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-navy-950">Modules</h1>
        <ButtonLink href="/admin/modules/new" className="px-4 py-2 text-sm">
          New module
        </ButtonLink>
      </div>
      <div className="mt-6">
        <DataTable
          rows={rows}
          editHref={(row) => `/admin/modules/${row.id}/edit`}
          columns={[
            { header: "Title", render: (r) => r.title },
            { header: "Slug", render: (r) => r.slug },
            { header: "Min tier", render: (r) => r.minTier },
            { header: "Status", render: (r) => r.status },
            { header: "Order", render: (r) => r.sortOrder },
            {
              header: "Lessons",
              render: (r) => (
                <Link href={`/admin/modules/${r.id}/lessons`} className="text-brand-green-600 hover:text-brand-green-700">
                  Manage lessons
                </Link>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
