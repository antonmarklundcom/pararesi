"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { allowLoginAttempt } from "@/lib/credential-ratelimit";
import { getClientIp } from "@/lib/request-ip";
import { safeNextPath } from "@/lib/safe-next-path";

const GENERIC_ERROR = "Incorrect email or password.";
const RATE_LIMITED_ERROR = "Too many attempts. Please try again in a few minutes.";

const BCRYPT_COST = 12;

/**
 * A real bcrypt hash of a random value nothing can log in with, compared
 * against when the account doesn't exist. Without it, "no such user" returns in
 * microseconds while a real account costs a full bcrypt verify, and the
 * difference is a reliable oracle for which addresses have accounts here —
 * which the generic error message exists to avoid leaking.
 *
 * Computed once, on the first login attempt rather than at import, so the
 * ~250ms it costs never lands during a build or a cold page render.
 */
let dummyPasswordHash: string | null = null;
function decoyHash(): string {
  dummyPasswordHash ??= bcrypt.hashSync(crypto.randomBytes(24).toString("hex"), BCRYPT_COST);
  return dummyPasswordHash;
}

export type LoginState = { error: string } | undefined;

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    return { error: GENERIC_ERROR };
  }

  const ip = await getClientIp();
  if (!allowLoginAttempt(email, ip)) {
    return { error: RATE_LIMITED_ERROR };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email));

  // Always pay the bcrypt cost, even with no account to check against — see
  // decoyHash. An account that exists but has never set a password (created by
  // a purchase webhook) takes the same branch.
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash || decoyHash());
  if (!user || !user.passwordHash || !passwordMatches) {
    return { error: GENERIC_ERROR };
  }

  const session = await getSession();
  session.userId = user.id;
  session.role = user.role;
  session.epoch = user.sessionEpoch;
  await session.save();

  redirect(next ?? (user.role === "admin" ? "/admin/modules" : "/portal"));
}
