import { describe, it, expect } from "vitest";
import { sessionEpochMatches } from "./session";

/**
 * QA-07-F12 (docs/qa-report-phase7.md). iron-session keeps no server-side
 * session state — the sealed cookie *is* the session — so before this there was
 * nothing a password change could invalidate, and a stolen cookie kept working
 * for its full 30-day life even after the victim reset their password.
 */
describe("sessionEpochMatches", () => {
  it("accepts a session issued under the account's current epoch", () => {
    expect(sessionEpochMatches(0, 0)).toBe(true);
    expect(sessionEpochMatches(4, 4)).toBe(true);
  });

  it("rejects a session issued before the last password change", () => {
    expect(sessionEpochMatches(0, 1)).toBe(false);
    expect(sessionEpochMatches(3, 7)).toBe(false);
  });

  it("treats a session minted before this column existed as epoch 0", () => {
    // Every pre-existing row defaults to 0, so deploying this must not log the
    // whole userbase out.
    expect(sessionEpochMatches(undefined, 0)).toBe(true);
    // …but one of those old sessions still dies at the next password change.
    expect(sessionEpochMatches(undefined, 1)).toBe(false);
  });
});
