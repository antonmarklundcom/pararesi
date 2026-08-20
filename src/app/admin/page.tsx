import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { loadAdminMetrics, formatUsdFromCents, RECENT_WINDOW_DAYS } from "@/lib/admin-metrics";
import { pendingOwnerConfig } from "@/lib/config-readiness";
import { nurtureCronStatus } from "@/lib/cron-status";
import { StatTile } from "@/components/admin/StatTile";
import { NurtureCronCard } from "@/components/admin/NurtureCronCard";

export const metadata: Metadata = {
  title: "Admin · Dashboard",
};

export const dynamic = "force-dynamic";

function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export default async function AdminDashboardPage() {
  await requireAdmin();

  const [metrics, cronStatus] = await Promise.all([loadAdminMetrics(), nurtureCronStatus()]);
  const configGaps = pendingOwnerConfig();

  const needsAttention = [
    metrics.webhooks.failed > 0
      ? {
          key: "webhooks-failed",
          text: `${metrics.webhooks.failed} webhook ${metrics.webhooks.failed === 1 ? "event" : "events"} failed — a paid customer may have received nothing.`,
          href: "/admin/webhooks",
          linkLabel: "Review and replay",
        }
      : null,
    metrics.webhooks.pending > 0
      ? {
          key: "webhooks-pending",
          text: `${metrics.webhooks.pending} webhook ${metrics.webhooks.pending === 1 ? "event" : "events"} never finished processing.`,
          href: "/admin/webhooks",
          linkLabel: "Review and replay",
        }
      : null,
    metrics.members.awaitingPassword > 0
      ? {
          key: "awaiting-password",
          text: `${metrics.members.awaitingPassword} paying ${metrics.members.awaitingPassword === 1 ? "member has" : "members have"} never set a password — check the set-password email was delivered.`,
          href: "/admin/users",
          linkLabel: "Open users",
        }
      : null,
    metrics.subscriptions.pastDue > 0
      ? {
          key: "past-due",
          text: `${metrics.subscriptions.pastDue} subscription ${metrics.subscriptions.pastDue === 1 ? "is" : "are"} past due. The portal already shows them the dunning banner.`,
          href: "/admin/users",
          linkLabel: "Open users",
        }
      : null,
  ].filter((item) => item !== null);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">Dashboard</h1>
      <p className="mt-2 text-sm text-brand-navy-900/60">
        Everything below is live. &ldquo;Last {RECENT_WINDOW_DAYS} days&rdquo; figures use a rolling window.
      </p>

      {needsAttention.length > 0 ? (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-amber-900/70">Needs attention</p>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-900">
            {needsAttention.map((item) => (
              <li key={item.key}>
                {item.text}{" "}
                <Link href={item.href} className="underline hover:no-underline">
                  {item.linkLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {configGaps.length > 0 ? (
        <div className="mt-6 rounded-xl border border-red-300 bg-red-50 px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-red-900/70">Unfilled owner config</p>
          <ul className="mt-2 space-y-1.5 text-sm text-red-900">
            {configGaps.map((gap) => (
              <li key={gap.field}>
                <code>{gap.field}</code> in <code>src/config/site.ts</code> — blocks {gap.blocks}.
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-brand-navy-900/50">Revenue</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Net recorded revenue"
          value={formatUsdFromCents(metrics.revenue.netCents)}
          detail={`${metrics.revenue.orderCount} orders, ${formatUsdFromCents(metrics.revenue.refundedCents)} refunded`}
        />
        <StatTile
          label={`Last ${RECENT_WINDOW_DAYS} days`}
          value={formatUsdFromCents(metrics.revenue.recentNetCents)}
        />
        <StatTile
          label="Active subscriptions"
          value={metrics.subscriptions.active}
          detail={metrics.subscriptions.ended > 0 ? `${metrics.subscriptions.ended} ended` : undefined}
        />
        <StatTile
          label="Past due"
          value={metrics.subscriptions.pastDue}
          tone={metrics.subscriptions.pastDue > 0 ? "warn" : "neutral"}
        />
      </div>
      <p className="mt-2 text-xs text-brand-navy-900/50">
        Revenue counts orders recorded by the <code>order_created</code> webhook. Subscription
        renewals arrive as invoices and extend access without creating a new order row, so
        Lemon Squeezy remains the source of truth for total takings.
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-brand-navy-900/50">Members</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Members"
          value={metrics.members.total}
          detail={`${metrics.members.newRecently} new in ${RECENT_WINDOW_DAYS} days`}
        />
        <StatTile label="Insider access" value={metrics.members.insider} />
        <StatTile label="Guide access" value={metrics.members.guide} />
        <StatTile
          label="Lapsed insiders"
          value={metrics.members.lapsed}
          detail="Billed as insider, access expired"
        />
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-brand-navy-900/50">Leads</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Captured"
          value={metrics.leads.total}
          detail={`${metrics.leads.newRecently} new in ${RECENT_WINDOW_DAYS} days`}
        />
        <StatTile label="Mailable" value={metrics.leads.confirmed} detail="Confirmed, not unsubscribed" />
        <StatTile
          label="Awaiting confirmation"
          value={metrics.leads.pending}
          detail={`${percent(metrics.leads.confirmRate)} of all signups have confirmed`}
        />
        <StatTile label="Unsubscribed" value={metrics.leads.unsubscribed} />
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-brand-navy-900/50">Health</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <StatTile label="Webhooks processed" value={metrics.webhooks.processed} />
        <StatTile
          label="Webhooks failed"
          value={metrics.webhooks.failed}
          tone={metrics.webhooks.failed > 0 ? "bad" : "neutral"}
        />
        <StatTile
          label="Webhooks pending"
          value={metrics.webhooks.pending}
          tone={metrics.webhooks.pending > 0 ? "warn" : "neutral"}
        />
      </div>
      <div className="mt-4">
        <NurtureCronCard status={cronStatus} />
      </div>
    </div>
  );
}
