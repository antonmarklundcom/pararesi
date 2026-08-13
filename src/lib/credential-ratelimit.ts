import { rateLimit } from "./ratelimit";

/**
 * The rate-limit policy for every public credential endpoint, in one place.
 *
 * Two things this file exists to guarantee, both of which were missed when each
 * action rolled its own:
 *
 * 1. Every endpoint is limited *by IP as well as by email*. A per-email bucket
 *    alone stops an attacker grinding one account but does nothing about one
 *    host walking a list of addresses — which on /forgot-password means sending
 *    a real password-reset email to every address it can guess, from our
 *    verified sending domain.
 * 2. The token-submitting endpoints are limited at all. /reset-password and
 *    /set-password each run a bcrypt hash (cost 12) per submission before
 *    anything else, on a single-process deployment, so an unlimited endpoint is
 *    a cheap way to eat the CPU the rest of the site needs.
 *
 * `Limiter` is injected so the policy can be tested without waiting out real
 * windows or leaking buckets between tests.
 */
export type Limiter = (key: string, limit: number, windowMs: number) => boolean;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const CREDENTIAL_LIMITS = {
  login: { email: { limit: 5, windowMs: 15 * MINUTE }, ip: { limit: 5, windowMs: 15 * MINUTE } },
  forgotPassword: { email: { limit: 3, windowMs: HOUR }, ip: { limit: 10, windowMs: HOUR } },
  /** Per-IP only: the submitter is identified by their token, not an address. */
  passwordToken: { ip: { limit: 10, windowMs: 15 * MINUTE } },
} as const;

/**
 * Both buckets are always consumed, never short-circuited: `a && b` would leave
 * the second bucket untouched whenever the first said no, so an attacker who
 * had already tripped the email limit would be spending nothing against their
 * IP limit.
 */
function allowBoth(a: boolean, b: boolean): boolean {
  return a && b;
}

export function allowLoginAttempt(email: string, ip: string, limit: Limiter = rateLimit): boolean {
  const { login } = CREDENTIAL_LIMITS;
  return allowBoth(
    limit(`login:email:${email}`, login.email.limit, login.email.windowMs),
    limit(`login:ip:${ip}`, login.ip.limit, login.ip.windowMs),
  );
}

export function allowForgotPasswordRequest(email: string, ip: string, limit: Limiter = rateLimit): boolean {
  const { forgotPassword } = CREDENTIAL_LIMITS;
  return allowBoth(
    limit(`forgot:email:${email}`, forgotPassword.email.limit, forgotPassword.email.windowMs),
    limit(`forgot:ip:${ip}`, forgotPassword.ip.limit, forgotPassword.ip.windowMs),
  );
}

/** For /set-password and /reset-password, which submit a token rather than an email. */
export function allowPasswordTokenSubmit(ip: string, limit: Limiter = rateLimit): boolean {
  const { passwordToken } = CREDENTIAL_LIMITS;
  return limit(`password-token:ip:${ip}`, passwordToken.ip.limit, passwordToken.ip.windowMs);
}
