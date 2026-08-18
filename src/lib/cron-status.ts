import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cronRuns } from "@/db/schema";
import { NURTURE_JOB } from "@/lib/nurture-run";

export interface CronRunSummary {
  ranAt: Date;
  eligible: number;
  sent: number;
  failed: number;
}

export interface NurtureCronStatus {
  /** The most recent run of any outcome, or null when the cron has never fired. */
  lastRun: CronRunSummary | null;
  /** The most recent run that sent everything it tried to. */
  lastSuccessfulRun: CronRunSummary | null;
  /** True when nothing has run inside the expected window — the cron is not firing. */
  stale: boolean;
}

/**
 * The schedule is daily (docs/04 §2), so two missed days is the point at which
 * "nothing was due" stops being a plausible explanation.
 */
export const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

/** Pure half, so the staleness rule is testable without a database. */
export function summarizeCronRuns(runs: CronRunSummary[], now: Date): NurtureCronStatus {
  const byNewest = [...runs].sort((a, b) => b.ranAt.getTime() - a.ranAt.getTime());
  const lastRun = byNewest[0] ?? null;

  return {
    lastRun,
    lastSuccessfulRun: byNewest.find((run) => run.failed === 0) ?? null,
    // Never having run counts as stale: on a live deployment that means the
    // cron entry was never installed, which is exactly the invisible failure
    // this is here to surface.
    stale: !lastRun || now.getTime() - lastRun.ranAt.getTime() > STALE_AFTER_MS,
  };
}

export async function nurtureCronStatus(now: Date = new Date()): Promise<NurtureCronStatus> {
  const rows = await db
    .select()
    .from(cronRuns)
    .where(eq(cronRuns.job, NURTURE_JOB))
    .orderBy(desc(cronRuns.ranAt))
    // Enough to find the last clean run behind a short streak of failures,
    // without reading a table that grows by one row a day forever.
    .limit(30);

  return summarizeCronRuns(
    rows.map((row) => ({
      ranAt: row.ranAt,
      eligible: row.eligible,
      sent: row.sent,
      failed: row.failed,
    })),
    now,
  );
}
