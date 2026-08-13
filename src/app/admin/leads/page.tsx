import type { Metadata } from "next";
import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { leads, leadEmails } from "@/db/schema";
import { DataTable } from "@/components/admin/DataTable";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deleteLeadAction } from "./actions";

export const metadata: Metadata = {
  title: "Admin · Leads",
};

export const dynamic = "force-dynamic";

// Display labels for the NURTURE_STEPS keys in src/lib/nurture.ts. Kept here
// rather than imported so a step key with no label yet (e.g. mid-rollout of a
// new step) still renders, just under its raw key.
const NURTURE_STEP_LABELS: Record<string, string> = {
  "cost-breakdown": "Cost breakdown",
  "three-mistakes": "Three mistakes",
  "guide-offer": "Guide offer",
};

export default async function AdminLeadsPage() {
  const rows = await db.select().from(leads).orderBy(desc(leads.createdAt));

  const sentEmailsByLeadId = new Map<number, { step: string; sentAt: Date }[]>();
  if (rows.length > 0) {
    const emailRows = await db
      .select()
      .from(leadEmails)
      .where(inArray(leadEmails.leadId, rows.map((r) => r.id)));
    for (const row of emailRows) {
      const existing = sentEmailsByLeadId.get(row.leadId) ?? [];
      existing.push({ step: row.step, sentAt: row.sentAt });
      sentEmailsByLeadId.set(row.leadId, existing);
    }
    for (const sent of sentEmailsByLeadId.values()) {
      sent.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
    }
  }

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
            {
              header: "Nurture emails",
              render: (r) => {
                const sent = sentEmailsByLeadId.get(r.id) ?? [];
                if (sent.length === 0) {
                  return <span className="text-brand-navy-900/40">none sent</span>;
                }
                return (
                  <ul className="space-y-0.5">
                    {sent.map((s) => (
                      <li key={s.step}>
                        {NURTURE_STEP_LABELS[s.step] ?? s.step}{" "}
                        <span className="text-brand-navy-900/50">
                          ({new Date(s.sentAt).toLocaleDateString()})
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              },
            },
            { header: "", render: (r) => <DeleteButton action={deleteLeadAction.bind(null, r.id)} /> },
          ]}
        />
      </div>
    </div>
  );
}
