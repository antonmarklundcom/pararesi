import { describe, it, expect } from "vitest";
import { summarizeCronRuns, STALE_AFTER_MS, type CronRunSummary } from "./cron-status";

const NOW = new Date("2026-08-18T09:00:00Z");
const HOUR = 60 * 60 * 1000;

function run(hoursAgo: number, overrides: Partial<CronRunSummary> = {}): CronRunSummary {
  return {
    ranAt: new Date(NOW.getTime() - hoursAgo * HOUR),
    eligible: 2,
    sent: 2,
    failed: 0,
    ...overrides,
  };
}

describe("summarizeCronRuns", () => {
  it("treats a cron that has never fired as stale — that's the invisible failure", () => {
    expect(summarizeCronRuns([], NOW)).toEqual({
      lastRun: null,
      lastSuccessfulRun: null,
      stale: true,
    });
  });

  it("picks the newest run whatever order the rows arrive in", () => {
    const status = summarizeCronRuns([run(30), run(6), run(54)], NOW);

    expect(status.lastRun?.ranAt).toEqual(run(6).ranAt);
    expect(status.stale).toBe(false);
  });

  it("goes stale once nothing has run for two days", () => {
    const justInside = summarizeCronRuns([run(47)], NOW);
    const justOutside = summarizeCronRuns([run(49)], NOW);

    expect(STALE_AFTER_MS).toBe(48 * HOUR);
    expect(justInside.stale).toBe(false);
    expect(justOutside.stale).toBe(true);
  });

  it("keeps the last clean run separate from the last run", () => {
    const status = summarizeCronRuns([run(2, { sent: 1, failed: 1 }), run(26)], NOW);

    expect(status.lastRun?.failed).toBe(1);
    expect(status.lastSuccessfulRun?.ranAt).toEqual(run(26).ranAt);
  });

  it("reports no clean run when every recorded run failed something", () => {
    const status = summarizeCronRuns([run(2, { failed: 1 }), run(26, { failed: 3 })], NOW);

    expect(status.lastSuccessfulRun).toBeNull();
    expect(status.stale).toBe(false);
  });

  it("counts a run that had nothing to send as a healthy run", () => {
    const status = summarizeCronRuns([run(1, { eligible: 0, sent: 0 })], NOW);

    expect(status.stale).toBe(false);
    expect(status.lastSuccessfulRun?.sent).toBe(0);
  });
});
