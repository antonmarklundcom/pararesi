"use server";

import { redirect } from "next/navigation";
import { applyPasswordFromToken } from "@/lib/auth-flows";

export type ResetPasswordState = { error: string } | undefined;

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    return { error: "This link is invalid or has expired. Request a new one." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const error = await applyPasswordFromToken(token, password, "reset");
  if (error) return { error };

  redirect("/portal");
}
