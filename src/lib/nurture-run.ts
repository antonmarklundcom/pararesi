import { and, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { cronRuns, leadEmails, leads } from "@/db/schema";
import { appUrl, sendLeadEmail } from "@/lib/lead-email";
import { selectNurtureSends, type NurtureLead, type NurtureStep } from "@/lib/nurture";

export type NurtureRunResult = { eligible: number; sent: number; failed: number };

/** `cron_runs.job` value for the nurture schedule. */
export const NURTURE_JOB = "nurture";

/**
 * Data the run needs, behind an interface so the send loop's ordering and
 * failure handling can be exercised without a database or an email provider.
 */
export interface NurtureRunDeps {
  /** Every confirmed, non-unsubscribed lead. */
  listMailableLeads(): Promise<NurtureLead[]>;
  /** Steps already sent, per lead id, for the given leads. */
  listSentSteps(leadIds: number[]): Promise<Map<number, string[]>>;
  send(lead: NurtureLead, step: NurtureStep): Promise<void>;
  recordSent(leadId: number, stepKey: string): Promise<void>;
  /**
   * Records that a run happened, whatever it found. This is the liveness
   * signal: without it, "the cron never fired" and "the cron fired and nothing
   * was due" look identical from the admin panel.
   */
  recordRun(result: NurtureRunResult): Promise<void>;
  now(): Date;
}

export const productionNurtureDeps: NurtureRunDeps = {
  async listMailableLeads() {
    const rows = await db
      .select()
      .from(leads)
      .where(and(isNotNull(leads.confirmedAt), isNull(leads.unsubscribedAt)));

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      confirmedAt: row.confirmedAt ?? null,
      unsubscribedAt: row.unsubscribedAt ?? null,
    }));
  },

  async listSentSteps(leadIds) {
    const byLeadId = new Map<number, string[]>();
    if (leadIds.length === 0) return byLeadId;

    const rows = await db.select().from(leadEmails).where(inArray(leadEmails.leadId, leadIds));
    for (const row of rows) {
      byLeadId.set(row.leadId, [...(byLeadId.get(row.leadId) ?? []), row.step]);
    }
    return byLeadId;
  },

  async send(lead, step) {
    await sendLeadEmail({
      leadId: lead.id,
      to: lead.email,
      template: step.template,
      data: { guideUrl: `${appUrl()}/guide` },
    });
  },

  async recordSent(leadId, stepKey) {
    await db.insert(leadEmails).values({ leadId, step: stepKey });
  },

  async recordRun(result) {
    await db.insert(cronRuns).values({ job: NURTURE_JOB, ...result });
  },

  now: () => new Date(),
};

/**
 * Sends at most one nurture email per eligible lead.
 *
 * The send is recorded immediately after it succeeds, so a run that dies
 * halfway leaves the leads it already mailed marked as done. A lead whose send
 * throws is simply left for the next run: the unique index on
 * (lead_id, step) means a retry can never double-send a step that was
 * recorded, and one bad address doesn't stop the rest of the batch.
 */
export async function runNurtureBatch(
  deps: NurtureRunDeps = productionNurtureDeps,
): Promise<NurtureRunResult> {
  const mailable = await deps.listMailableLeads();
  const sentStepsByLeadId = await deps.listSentSteps(mailable.map((lead) => lead.id));

  const due = selectNurtureSends({ leads: mailable, sentStepsByLeadId, now: deps.now() });

  let sent = 0;
  let failed = 0;

  for (const { lead, step } of due) {
    try {
      await deps.send(lead, step);
      await deps.recordSent(lead.id, step.key);
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`[nurture] step "${step.key}" for lead ${lead.id} failed:`, error);
    }
  }

  const result = { eligible: due.length, sent, failed };

  // Recorded outside the per-lead try/catch and after the loop, so the row
  // reflects what the run actually achieved. A failure to record is logged
  // rather than thrown: the emails are already sent, and losing the liveness
  // row must not turn a good run into a 500 that invites a retry.
  try {
    await deps.recordRun(result);
  } catch (error) {
    console.error("[nurture] failed to record the run:", error);
  }

  return result;
}
