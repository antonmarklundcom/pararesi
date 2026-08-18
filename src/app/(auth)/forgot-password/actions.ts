"use server";

import { eq } from "drizzle-orm";
import { env } from "@/config/env";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createPasswordToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { allowForgotPasswordRequest } from "@/lib/credential-ratelimit";
import { getClientIp } from "@/lib/request-ip";

// Always the same message, whether or not the email exists — no user enumeration.
const GENERIC_MESSAGE = "If that email has an account, we've sent a password reset link.";

export type ForgotPasswordState = { message: string } | undefined;

export async function forgotPasswordAction(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { message: GENERIC_MESSAGE };
  }

  // Per-IP as well as per-email: the email bucket stops one account being
  // ground down, but on its own it let a single host send a genuine
  // password-reset mail to every address it could guess, from our verified
  // sending domain. See src/lib/credential-ratelimit.ts.
  if (!allowForgotPasswordRequest(email, await getClientIp())) {
    return { message: GENERIC_MESSAGE };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email));

  if (user) {
    const token = await createPasswordToken(user.id, "reset");
    const resetUrl = `${env.appUrl()}/reset-password?token=${token}`;
    await sendEmail({
      to: user.email,
      template: "password-reset",
      data: { resetUrl, name: user.name ?? "" },
    });
  }

  return { message: GENERIC_MESSAGE };
}
