import { describe, it, expect } from "vitest";
import {
  allowForgotPasswordRequest,
  allowLoginAttempt,
  allowPasswordTokenSubmit,
  type Limiter,
} from "./credential-ratelimit";

/**
 * A fake limiter with the same fixed-window semantics as src/lib/ratelimit.ts,
 * minus the wall clock: buckets never expire within a test.
 */
function fakeLimiter() {
  const counts = new Map<string, number>();
  const keys: string[] = [];

  const limit: Limiter = (key, max) => {
    keys.push(key);
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return next <= max;
  };

  return { limit, keys, counts };
}

describe("allowLoginAttempt", () => {
  it("consumes an email bucket and an IP bucket", () => {
    const { limit, keys } = fakeLimiter();

    expect(allowLoginAttempt("jane@example.com", "203.0.113.9", limit)).toBe(true);

    expect(keys).toEqual(["login:email:jane@example.com", "login:ip:203.0.113.9"]);
  });

  it("blocks once one host has exhausted its IP bucket, whatever email it uses", () => {
    const { limit } = fakeLimiter();
    const attempt = (email: string) => allowLoginAttempt(email, "203.0.113.9", limit);

    for (let i = 0; i < 5; i += 1) expect(attempt(`user${i}@example.com`)).toBe(true);

    expect(attempt("user5@example.com")).toBe(false);
  });
});

/**
 * QA-07-F7 (docs/qa-report-phase7.md). /forgot-password was limited per email
 * only, so a single host could walk an address list and have us send a genuine
 * password-reset email to each one from our verified sending domain.
 */
describe("allowForgotPasswordRequest", () => {
  it("consumes an email bucket and an IP bucket", () => {
    const { limit, keys } = fakeLimiter();

    expect(allowForgotPasswordRequest("jane@example.com", "203.0.113.9", limit)).toBe(true);

    expect(keys).toEqual(["forgot:email:jane@example.com", "forgot:ip:203.0.113.9"]);
  });

  it("stops one host from spraying reset mail across many addresses", () => {
    const { limit } = fakeLimiter();
    const request = (email: string) => allowForgotPasswordRequest(email, "203.0.113.9", limit);

    // Each address is fresh, so the per-email bucket never fires — the IP
    // bucket is the only thing standing between an attacker and 1000 emails.
    for (let i = 0; i < 10; i += 1) expect(request(`victim${i}@example.com`)).toBe(true);

    expect(request("victim10@example.com")).toBe(false);
    expect(request("victim11@example.com")).toBe(false);
  });

  it("still limits one address hammered from many hosts", () => {
    const { limit } = fakeLimiter();
    const request = (ip: string) => allowForgotPasswordRequest("victim@example.com", ip, limit);

    for (let i = 0; i < 3; i += 1) expect(request(`203.0.113.${i}`)).toBe(true);

    expect(request("203.0.113.99")).toBe(false);
  });

  it("charges the IP bucket even when the email bucket already said no", () => {
    const { limit, counts } = fakeLimiter();

    for (let i = 0; i < 6; i += 1) {
      allowForgotPasswordRequest("victim@example.com", "203.0.113.9", limit);
    }

    // Six attempts, six IP charges: short-circuiting on the email bucket would
    // have made repeat attempts against one address free of IP budget.
    expect(counts.get("forgot:ip:203.0.113.9")).toBe(6);
  });
});

/**
 * QA-07-F8. /reset-password and /set-password run a bcrypt hash (cost 12) per
 * submission, on a single-process deployment, and had no limit at all.
 */
describe("allowPasswordTokenSubmit", () => {
  it("limits per IP", () => {
    const { limit, keys } = fakeLimiter();
    const submit = () => allowPasswordTokenSubmit("203.0.113.9", limit);

    for (let i = 0; i < 10; i += 1) expect(submit()).toBe(true);

    expect(submit()).toBe(false);
    expect(new Set(keys)).toEqual(new Set(["password-token:ip:203.0.113.9"]));
  });

  it("keeps separate hosts independent", () => {
    const { limit } = fakeLimiter();

    for (let i = 0; i < 10; i += 1) allowPasswordTokenSubmit("203.0.113.9", limit);

    expect(allowPasswordTokenSubmit("198.51.100.4", limit)).toBe(true);
  });
});
