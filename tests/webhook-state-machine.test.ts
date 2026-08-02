import { describe, it, expect } from "vitest";

/**
 * The end-to-end webhook state machine (each event -> expected tier and
 * tierExpiresAt) needs the handlers to read and write through an injectable
 * store instead of importing the drizzle `db` singleton directly. That
 * refactor lands with the B1/B2 fix in PR 2; this suite is skipped until then
 * so PR 1 can add the harness and CI without also rewriting the route.
 *
 * The single case below is the money bug from docs/07-review-and-next-steps.md
 * B1, written out so the intended behaviour is on record before the fix.
 */
describe.skip("webhook state machine [unskipped in PR 2 — needs the injectable webhook store]", () => {
  it("extends tierExpiresAt when subscription_payment_success arrives for month 2", async () => {
    // month 1: subscription_created, renews_at 2026-08-17
    //   -> tier = insider, tierExpiresAt = 2026-08-20 (renews_at + 3 grace days)
    // month 2: subscription_payment_success, subscription now renews 2026-09-17
    //   -> tier = insider, tierExpiresAt = 2026-09-20
    //
    // Today the second event is swallowed as a duplicate and tierExpiresAt
    // stays at 2026-08-20, so the member loses access mid-subscription.
    expect(true).toBe(false);
  });
});
