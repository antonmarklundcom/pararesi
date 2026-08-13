import { describe, it, expect } from "vitest";
import { isPastDue, PAST_DUE_STATUS } from "./subscription-status";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "./webhook/types";

describe("isPastDue", () => {
  it("is true only for the past_due status", () => {
    expect(isPastDue({ status: PAST_DUE_STATUS })).toBe(true);
  });

  it.each(["active", "on_trial", "cancelled", "expired", "unpaid", "paused"])(
    "is false for %s",
    (status) => {
      expect(isPastDue({ status })).toBe(false);
    },
  );

  it("is false when the member has no subscription row at all", () => {
    expect(isPastDue(undefined)).toBe(false);
    expect(isPastDue(null)).toBe(false);
  });

  it("describes a status that still grants access — the banner warns, it doesn't lock", () => {
    expect(ACTIVE_SUBSCRIPTION_STATUSES).toContain(PAST_DUE_STATUS);
  });
});
