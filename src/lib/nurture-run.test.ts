import { describe, it, expect, beforeEach, vi } from "vitest";
import { runNurtureBatch, type NurtureRunDeps, type NurtureRunResult } from "./nurture-run";
import type { NurtureLead, NurtureStep } from "./nurture";

const CONFIRMED_AT = new Date("2026-08-01T09:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function lead(id: number, overrides: Partial<NurtureLead> = {}): NurtureLead {
  return {
    id,
    email: `lead-${id}@example.com`,
    confirmedAt: CONFIRMED_AT,
    unsubscribedAt: null,
    ...overrides,
  };
}

/** An in-memory stand-in for the leads + lead_emails tables and Resend. */
class FakeRun implements NurtureRunDeps {
  sentLog: { leadId: number; step: string }[] = [];
  recorded = new Map<number, string[]>();
  failFor = new Set<number>();
  runs: NurtureRunResult[] = [];

  constructor(
    private leads: NurtureLead[],
    private clock: Date,
  ) {}

  async listMailableLeads() {
    // Mirrors the SQL filter: confirmed and not unsubscribed.
    return this.leads.filter((l) => l.confirmedAt && !l.unsubscribedAt);
  }

  async listSentSteps(leadIds: number[]) {
    return new Map(leadIds.map((id) => [id, this.recorded.get(id) ?? []]));
  }

  async send(lead: NurtureLead, step: NurtureStep) {
    if (this.failFor.has(lead.id)) throw new Error("resend blew up");
    this.sentLog.push({ leadId: lead.id, step: step.key });
  }

  async recordRun(result: NurtureRunResult) {
    this.runs.push(result);
  }

  async recordSent(leadId: number, stepKey: string) {
    const steps = this.recorded.get(leadId) ?? [];
    // Mirrors lead_emails_lead_id_step_unique.
    if (steps.includes(stepKey)) throw new Error("Duplicate entry for key 'lead_emails_lead_id_step_unique'");
    this.recorded.set(leadId, [...steps, stepKey]);
  }

  now() {
    return this.clock;
  }

  advanceDays(days: number) {
    this.clock = new Date(this.clock.getTime() + days * DAY_MS);
  }
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("runNurtureBatch", () => {
  it("sends the due step and records it", async () => {
    const run = new FakeRun([lead(1)], new Date(CONFIRMED_AT.getTime() + 2 * DAY_MS));

    expect(await runNurtureBatch(run)).toEqual({ eligible: 1, sent: 1, failed: 0 });
    expect(run.sentLog).toEqual([{ leadId: 1, step: "cost-breakdown" }]);
  });

  it("does not double-send when run twice in the same day", async () => {
    const run = new FakeRun([lead(1)], new Date(CONFIRMED_AT.getTime() + 2 * DAY_MS));

    await runNurtureBatch(run);
    expect(await runNurtureBatch(run)).toEqual({ eligible: 0, sent: 0, failed: 0 });
    expect(run.sentLog).toHaveLength(1);
  });

  it("walks a lead through the whole sequence, one email per due day", async () => {
    const run = new FakeRun([lead(1)], new Date(CONFIRMED_AT.getTime() + 2 * DAY_MS));

    await runNurtureBatch(run);
    run.advanceDays(2);
    await runNurtureBatch(run);
    run.advanceDays(2);
    await runNurtureBatch(run);
    run.advanceDays(2);
    await runNurtureBatch(run);

    expect(run.sentLog.map((s) => s.step)).toEqual([
      "cost-breakdown",
      "three-mistakes",
      "guide-offer",
    ]);
  });

  it("never mails an unsubscribed or unconfirmed lead", async () => {
    const run = new FakeRun(
      [lead(1, { unsubscribedAt: CONFIRMED_AT }), lead(2, { confirmedAt: null })],
      new Date(CONFIRMED_AT.getTime() + 3 * DAY_MS),
    );

    expect(await runNurtureBatch(run)).toEqual({ eligible: 0, sent: 0, failed: 0 });
    expect(run.sentLog).toEqual([]);
  });

  it("stops sending to a lead who unsubscribes mid-sequence", async () => {
    const subject = lead(1);
    const run = new FakeRun([subject], new Date(CONFIRMED_AT.getTime() + 2 * DAY_MS));

    await runNurtureBatch(run);
    subject.unsubscribedAt = new Date();
    run.advanceDays(2);

    expect(await runNurtureBatch(run)).toEqual({ eligible: 0, sent: 0, failed: 0 });
    expect(run.sentLog).toHaveLength(1);
  });

  it("keeps going when one lead's send fails, and retries that lead next run", async () => {
    const run = new FakeRun([lead(1), lead(2)], new Date(CONFIRMED_AT.getTime() + 2 * DAY_MS));
    run.failFor.add(1);

    expect(await runNurtureBatch(run)).toEqual({ eligible: 2, sent: 1, failed: 1 });
    expect(run.sentLog).toEqual([{ leadId: 2, step: "cost-breakdown" }]);

    run.failFor.clear();
    expect(await runNurtureBatch(run)).toEqual({ eligible: 1, sent: 1, failed: 0 });
    expect(run.sentLog).toContainEqual({ leadId: 1, step: "cost-breakdown" });
  });

  it("records every run, including one that had nothing to send", async () => {
    // This is the liveness signal /admin/leads reads: a cron that fired and
    // found nothing must look different from a cron that never fired.
    const run = new FakeRun([lead(1)], CONFIRMED_AT);

    expect(await runNurtureBatch(run)).toEqual({ eligible: 0, sent: 0, failed: 0 });
    expect(run.runs).toEqual([{ eligible: 0, sent: 0, failed: 0 }]);

    run.advanceDays(2);
    await runNurtureBatch(run);

    expect(run.runs).toEqual([
      { eligible: 0, sent: 0, failed: 0 },
      { eligible: 1, sent: 1, failed: 0 },
    ]);
  });

  it("still reports a successful run when recording the run itself fails", async () => {
    // The emails are already sent; losing the liveness row must not turn a good
    // run into a 500 that invites the cron to retry it.
    const run = new FakeRun([lead(1)], new Date(CONFIRMED_AT.getTime() + 2 * DAY_MS));
    run.recordRun = async () => {
      throw new Error("insert failed");
    };

    expect(await runNurtureBatch(run)).toEqual({ eligible: 1, sent: 1, failed: 0 });
    expect(run.sentLog).toHaveLength(1);
  });
});
