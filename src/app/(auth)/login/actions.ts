"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { effectiveTier } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";

const GENERIC_ERROR = "Incorrect email or password.";
const RATE_LIMITED_ERROR = "Too many attempts. Please try again in a few minutes.";

export type LoginState = { error: string } | undefined;

function safeNextPath(next: FormDataEntryValue | null): string | null {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    return { error: GENERIC_ERROR };
  }

  const ip = await getClientIp();
  const allowedByEmail = rateLimit(`login:email:${email}`, 5, 15 * 60 * 1000);
  const allowedByIp = rateLimit(`login:ip:${ip}`, 5, 15 * 60 * 1000);
  if (!allowedByEmail || !allowedByIp) {
    return { error: RATE_LIMITED_ERROR };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email));

  if (!user || !user.passwordHash) {
    return { error: GENERIC_ERROR };
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return { error: GENERIC_ERROR };
  }

  const session = await getSession();
  session.userId = user.id;
  session.role = user.role;
  session.tier = await effectiveTier(user);
  await session.save();

  redirect(next ?? (user.role === "admin" ? "/admin/modules" : "/portal"));
}
