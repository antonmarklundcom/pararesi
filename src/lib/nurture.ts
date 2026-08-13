import type { EmailTemplate } from "@/lib/email";

/**
 * The C2 nurture sequence (docs/07): day 0 is the checklist, delivered on
 * /subscribe/confirm the moment the double opt-in completes, so it isn't a
 * scheduled step. Everything after it is.
 *
 * `dayOffset` counts from the lead's confirmation, not from signup: the clock
 * starts when consent is given.
 */
export type NurtureStep = {
  key: string;
  template: EmailTemplate;
  dayOffset: number;
};

export const NURTURE_STEPS: readonly NurtureStep[] = [
  { key: "cost-breakdown", template: "nurture-cost-breakdown", dayOffset: 2 },
  { key: "three-mistakes", template: "nurture-three-mistakes", dayOffset: 4 },
  { key: "guide-offer", template: "nurture-guide-offer", dayOffset: 6 },
] as const;

/**
 * How late a step may be sent. Anything overdue by more than this is dropped
 * rather than delivered: if the cron stops for a fortnight, or the sequence
 * ships to a list that confirmed months ago, nobody should suddenly receive a
 * "you signed up two days ago" email. Missing an email is recoverable; mailing
 * a dormant list is what gets a sending domain blocked.
 */
export const NURTURE_MAX_LATENESS_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export type NurtureLead = {
  id: number;
  email: string;
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
};

/**
 * The one step this lead should receive right now, or null.
 *
 * Only confirmed, non-unsubscribed leads are ever eligible — the same rule the
 * rest of the lead system enforces. At most one email per lead per run, and
 * always the earliest step still owed, so a lead who was missed for a few days
 * catches up in order instead of getting the whole sequence at once.
 */
export function dueNurtureStep(args: {
  lead: NurtureLead;
  /** Keys of steps already sent to this lead. */
  sentSteps: readonly string[];
  now: Date;
  steps?: readonly NurtureStep[];
}): NurtureStep | null {
  const { lead, sentSteps, now, steps = NURTURE_STEPS } = args;

  if (!lead.confirmedAt || lead.unsubscribedAt) return null;

  const daysSinceConfirmed = (now.getTime() - lead.confirmedAt.getTime()) / DAY_MS;
  if (daysSinceConfirmed < 0) return null;

  const sent = new Set(sentSteps);

  return (
    [...steps]
      .sort((a, b) => a.dayOffset - b.dayOffset)
      .find(
        (step) =>
          !sent.has(step.key) &&
          daysSinceConfirmed >= step.dayOffset &&
          daysSinceConfirmed < step.dayOffset + NURTURE_MAX_LATENESS_DAYS,
      ) ?? null
  );
}

/** Convenience for the cron endpoint: every lead with a step owed, paired with it. */
export function selectNurtureSends(args: {
  leads: readonly NurtureLead[];
  /** Sent step keys per lead id. */
  sentStepsByLeadId: ReadonlyMap<number, readonly string[]>;
  now: Date;
}): { lead: NurtureLead; step: NurtureStep }[] {
  const { leads, sentStepsByLeadId, now } = args;

  return leads.flatMap((lead) => {
    const step = dueNurtureStep({
      lead,
      sentSteps: sentStepsByLeadId.get(lead.id) ?? [],
      now,
    });
    return step ? [{ lead, step }] : [];
  });
}
