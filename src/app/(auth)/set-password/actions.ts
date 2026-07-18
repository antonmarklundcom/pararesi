"use server";

import { redirect } from "next/navigation";
import { applyPasswordFromToken } from "@/lib/auth-flows";

export type SetPasswordState = { error: string } | undefined;

export async function setPasswordAction(
  _prevState: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    return { error: "This link is invalid or has expired. Contact support for a new one." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const error = await applyPasswordFromToken(token, password, "set");
  if (error) return { error };

  redirect("/portal");
}
