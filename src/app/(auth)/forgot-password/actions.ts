"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createPasswordToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/ratelimit";

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

  const allowed = rateLimit(`forgot:email:${email}`, 3, 60 * 60 * 1000);
  if (!allowed) {
    return { message: GENERIC_MESSAGE };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email));

  if (user) {
    const token = await createPasswordToken(user.id, "reset");
    const resetUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
    await sendEmail({
      to: user.email,
      template: "password-reset",
      data: { resetUrl, name: user.name ?? "" },
    });
  }

  return { message: GENERIC_MESSAGE };
}
