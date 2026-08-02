import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { listRecentWebhookEvents, countByStatus } from "@/lib/webhook/admin";
import { WebhookEventRow } from "./WebhookEventRow";

export const metadata: Metadata = {
  title: "Admin · Webhooks",
};

export const dynamic = "force-dynamic";

export default async function AdminWebhooksPage() {
  await requireAdmin();

  const events = await listRecentWebhookEvents();
  const counts = countByStatus(events);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-navy-950">Webhooks</h1>
      </div>

      <div className="mt-6 flex gap-4">
        <div className="rounded-xl border border-brand-navy-900/10 bg-white px-5 py-3">
          <p className="text-xs uppercase tracking-wide text-brand-navy-900/50">Processed</p>
          <p className="mt-1 text-xl font-semibold text-brand-navy-950">{counts.processed}</p>
        </div>
        <div className="rounded-xl border border-brand-navy-900/10 bg-white px-5 py-3">
          <p className="text-xs uppercase tracking-wide text-brand-navy-900/50">Failed</p>
          <p className="mt-1 text-xl font-semibold text-red-700">{counts.failed}</p>
        </div>
        <div className="rounded-xl border border-brand-navy-900/10 bg-white px-5 py-3">
          <p className="text-xs uppercase tracking-wide text-brand-navy-900/50">Pending</p>
          <p className="mt-1 text-xl font-semibold text-amber-700">{counts.pending}</p>
        </div>
      </div>

      <div className="mt-6">
        {events.length === 0 ? (
          <p className="text-sm text-brand-navy-900/60">No webhook events yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-brand-navy-900/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-brand-navy-900/10 text-xs uppercase tracking-wide text-brand-navy-900/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Processed at</th>
                  <th className="px-4 py-3 font-medium">Received at</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <WebhookEventRow key={event.id} event={event} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
