import type { NurtureCronStatus } from "@/lib/cron-status";

function formatRunTime(date: Date): string {
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * Liveness for the daily nurture cron.
 *
 * "No emails went out" has two very different causes — nothing was due, or the
 * schedule isn't firing at all — and they are indistinguishable from the leads
 * table alone. This card is where a cron that was never installed becomes
 * visible.
 */
export function NurtureCronCard({ status }: { status: NurtureCronStatus }) {
  const { lastRun, lastSuccessfulRun, stale } = status;

  return (
    <div
      className={`rounded-xl border px-5 py-4 ${
        stale ? "border-amber-300 bg-amber-50" : "border-brand-navy-900/10 bg-white"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-brand-navy-900/50">Nurture cron</p>

      {lastRun ? (
        <>
          <p className="mt-1 text-sm text-brand-navy-950">
            Last run {formatRunTime(lastRun.ranAt)} · {lastRun.sent} sent
            {lastRun.eligible !== lastRun.sent ? ` of ${lastRun.eligible} due` : ""}
            {lastRun.failed > 0 ? (
              <span className="text-red-700"> · {lastRun.failed} failed</span>
            ) : null}
          </p>
          {lastRun.failed > 0 ? (
            <p className="mt-1 text-sm text-brand-navy-900/60">
              {lastSuccessfulRun
                ? `Last clean run ${formatRunTime(lastSuccessfulRun.ranAt)}.`
                : "No clean run recorded yet."}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-1 text-sm text-brand-navy-950">No run recorded yet.</p>
      )}

      {stale ? (
        <p className="mt-2 text-sm text-amber-800">
          The daily cron has not reported in. Check the Hostinger cron entry and that
          CRON_SECRET matches — see docs/04-launch-checklist.md §2.
        </p>
      ) : null}
    </div>
  );
}
