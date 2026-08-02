import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

/**
 * Deliberately minimal. `role` is here because middleware gates /admin before
 * a database round-trip and cannot use next/headers. Tier is NOT cached:
 * entitlement changes between requests (a subscription lapses, a refund lands)
 * and every gate re-reads it through effectiveTier, so a cached copy could
 * only ever be a stale second source of truth.
 */
export type SessionData = {
  userId: number;
  role: "admin" | "member";
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to a string of 32+ characters");
  }
  return secret;
}

export function getSessionOptions(): SessionOptions {
  return {
    cookieName: "pararesi_session",
    password: getSessionSecret(),
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
  };
}

// For use in Server Components / Server Actions / Route Handlers, where
// next/headers cookies() is available. Middleware builds its own session
// via getIronSession(request, response, getSessionOptions()) instead, since
// it can't use next/headers.
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), getSessionOptions());
}
