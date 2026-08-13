import { describe, it, expect } from "vitest";
import {
  NURTURE_STEPS,
  NURTURE_MAX_LATENESS_DAYS,
  dueNurtureStep,
  selectNurtureSends,
  type NurtureLead,
} from "./nurture";

const DAY_MS = 24 * 60 * 60 * 1000;
const CONFIRMED_AT = new Date("2026-08-01T09:00:00Z");

function lead(overrides: Partial<NurtureLead> = {}): NurtureLead {
  return {
    id: 1,
    email: "ana@example.com",
    confirmedAt: CONFIRMED_AT,
    unsubscribedAt: null,
    ...overrides,
  };
}

function daysAfterConfirmation(days: number): Date {
  return new Date(CONFIRMED_AT.getTime() + days * DAY_MS);
}

describe("NURTURE_STEPS", () => {
  it("is the day 2 / 4 / 6 sequence from docs/07 C2 — day 0 is the confirm page, not an email", () => {
    expect(NURTURE_STEPS.map((s) => [s.key, s.dayOffset])).toEqual([
      ["cost-breakdown", 2],
      ["three-mistakes", 4],
      ["guide-offer", 6],
    ]);
  });

  it("has a distinct template per step", () => {
    expect(new Set(NURTURE_STEPS.map((s) => s.template)).size).toBe(NURTURE_STEPS.length);
  });
});

describe("dueNurtureStep", () => {
  it("sends nothing to an unconfirmed lead, however long they've been in the table", () => {
    const result = dueNurtureStep({
      lead: lead({ confirmedAt: null }),
      sentSteps: [],
      now: daysAfterConfirmation(5),
    });

    expect(result).toBeNull();
  });

  it("sends nothing to an unsubscribed lead", () => {
    const result = dueNurtureStep({
      lead: lead({ unsubscribedAt: daysAfterConfirmation(1) }),
      sentSteps: [],
      now: daysAfterConfirmation(3),
    });

    expect(result).toBeNull();
  });

  it("sends nothing before the first step is due", () => {
    expect(
      dueNurtureStep({ lead: lead(), sentSteps: [], now: daysAfterConfirmation(1.9) }),
    ).toBeNull();
  });

  it("sends the day 2 email once day 2 has elapsed", () => {
    expect(
      dueNurtureStep({ lead: lead(), sentSteps: [], now: daysAfterConfirmation(2) })?.key,
    ).toBe("cost-breakdown");
  });

  it("moves to the next step only after the previous one was sent", () => {
    expect(
      dueNurtureStep({ lead: lead(), sentSteps: ["cost-breakdown"], now: daysAfterConfirmation(4) })
        ?.key,
    ).toBe("three-mistakes");
    expect(
      dueNurtureStep({
        lead: lead(),
        sentSteps: ["cost-breakdown", "three-mistakes"],
        now: daysAfterConfirmation(6),
      })?.key,
    ).toBe("guide-offer");
  });

  it("never re-sends a step: nothing left once the sequence is complete", () => {
    const result = dueNurtureStep({
      lead: lead(),
      sentSteps: ["cost-breakdown", "three-mistakes", "guide-offer"],
      now: daysAfterConfirmation(30),
    });

    expect(result).toBeNull();
  });

  it("sends the same step again on a second run only if it was never recorded", () => {
    // Two runs on the same day with no record written in between must produce
    // the same answer — the (lead_id, step) unique index is what stops the
    // second one from actually landing.
    const args = { lead: lead(), sentSteps: [], now: daysAfterConfirmation(3) } as const;
    expect(dueNurtureStep(args)?.key).toBe(dueNurtureStep(args)?.key);
  });

  it("catches a late lead up one email at a time, in order", () => {
    // Confirmed 6 days ago, cron never ran: they get day 2's email now, not all three.
    expect(
      dueNurtureStep({ lead: lead(), sentSteps: [], now: daysAfterConfirmation(6) })?.key,
    ).toBe("cost-breakdown");
  });

  it("drops a step that is overdue by more than the lateness window", () => {
    const now = daysAfterConfirmation(2 + NURTURE_MAX_LATENESS_DAYS);

    // Day 2's email is too stale to send, but day 4's is still in its window.
    expect(dueNurtureStep({ lead: lead(), sentSteps: [], now })?.key).toBe("three-mistakes");
  });

  it("sends nothing at all to a lead who confirmed long before the sequence existed", () => {
    expect(
      dueNurtureStep({ lead: lead(), sentSteps: [], now: daysAfterConfirmation(365) }),
    ).toBeNull();
  });

  it("ignores a clock that is behind the confirmation timestamp", () => {
    expect(
      dueNurtureStep({ lead: lead(), sentSteps: [], now: daysAfterConfirmation(-1) }),
    ).toBeNull();
  });

  it("counts from confirmation, not from signup", () => {
    const confirmedLate = lead({ confirmedAt: new Date("2026-08-10T09:00:00Z") });

    expect(
      dueNurtureStep({
        lead: confirmedLate,
        sentSteps: [],
        now: new Date("2026-08-11T09:00:00Z"),
      }),
    ).toBeNull();
    expect(
      dueNurtureStep({
        lead: confirmedLate,
        sentSteps: [],
        now: new Date("2026-08-12T09:00:00Z"),
      })?.key,
    ).toBe("cost-breakdown");
  });
});

describe("selectNurtureSends", () => {
  it("picks exactly the leads with a step owed, one step each", () => {
    const leads: NurtureLead[] = [
      lead({ id: 1 }),
      lead({ id: 2 }),
      lead({ id: 3, unsubscribedAt: CONFIRMED_AT }),
      lead({ id: 4, confirmedAt: null }),
    ];

    const sends = selectNurtureSends({
      leads,
      sentStepsByLeadId: new Map([[2, ["cost-breakdown"]]]),
      now: daysAfterConfirmation(4),
    });

    expect(sends.map((s) => [s.lead.id, s.step.key])).toEqual([
      [1, "cost-breakdown"],
      [2, "three-mistakes"],
    ]);
  });

  it("returns nothing when every lead is up to date", () => {
    const sends = selectNurtureSends({
      leads: [lead({ id: 1 })],
      sentStepsByLeadId: new Map([[1, ["cost-breakdown", "three-mistakes", "guide-offer"]]]),
      now: daysAfterConfirmation(10),
    });

    expect(sends).toEqual([]);
  });
});
