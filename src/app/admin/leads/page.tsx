import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { DataTable } from "@/components/admin/DataTable";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deleteLeadAction } from "./actions";

export const metadata: Metadata = {
  title: "Admin · Leads",
};

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  const rows = await db.select().from(leads).orderBy(desc(leads.createdAt));
  const confirmedCount = rows.filter((r) => r.confirmedAt && !r.unsubscribedAt).length;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">Leads</h1>
      <p className="mt-2 text-sm text-brand-navy-900/60">
        {rows.length} total · {confirmedCount} confirmed. Only confirmed, non-unsubscribed
        addresses may be mailed.
      </p>
      <div className="mt-6">
        <DataTable
          rows={rows}
          emptyMessage="No signups yet."
          columns={[
            { header: "Email", render: (r) => r.email },
            { header: "Source", render: (r) => r.source },
            {
              header: "Confirmed",
              render: (r) =>
                r.unsubscribedAt
                  ? "unsubscribed"
                  : r.confirmedAt
                    ? new Date(r.confirmedAt).toLocaleDateString()
                    : "—",
            },
            { header: "Created", render: (r) => new Date(r.createdAt).toLocaleDateString() },
            { header: "", render: (r) => <DeleteButton action={deleteLeadAction.bind(null, r.id)} /> },
          ]}
        />
      </div>
    </div>
  );
}
