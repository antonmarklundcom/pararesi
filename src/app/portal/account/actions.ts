"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcrypt";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { users, subscriptions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getCustomerPortalUrl } from "@/lib/lemonsqueezy";

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 8;
const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "on_trial", "past_due"];

export type ChangePasswordState = { error?: string; success?: boolean } | undefined;

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUser();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!user.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return { error: "Current password is incorrect." };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

  return { success: true };
}

export async function manageSubscriptionAction() {
  const user = await requireUser();

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), inArray(subscriptions.status, ACTIVE_SUBSCRIPTION_STATUSES)));

  if (!subscription) redirect("/portal/account");

  const url = await getCustomerPortalUrl(subscription.lsSubscriptionId);
  redirect(url);
}
