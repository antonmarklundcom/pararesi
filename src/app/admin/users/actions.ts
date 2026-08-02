"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, purchases, subscriptions, lessonProgress, passwordTokens } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export async function updateUserAction(id: number, formData: FormData) {
  await requireAdmin();

  const tierExpiresAtRaw = String(formData.get("tierExpiresAt") ?? "");

  await db
    .update(users)
    .set({
      role: String(formData.get("role") ?? "member") as "admin" | "member",
      tier: String(formData.get("tier") ?? "none") as "none" | "guide" | "insider",
      tierExpiresAt: tierExpiresAtRaw ? new Date(tierExpiresAtRaw) : null,
    })
    .where(eq(users.id, id));

  redirect("/admin/users");
}

/**
 * Everything /privacy promises a user can request a copy of: their profile
 * (minus the password hash — a security artifact, not personal data) plus
 * purchases, subscriptions, and course progress. Returned as a pretty-printed
 * JSON string for the admin page to offer as a download.
 */
export async function exportUserJsonAction(id: number): Promise<string> {
  await requireAdmin();

  const [profile] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      tier: users.tier,
      tierExpiresAt: users.tierExpiresAt,
      lsCustomerId: users.lsCustomerId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, id));
  if (!profile) throw new Error("User not found");

  const userPurchases = await db.select().from(purchases).where(eq(purchases.userId, id));
  const userSubscriptions = await db.select().from(subscriptions).where(eq(subscriptions.userId, id));
  const userLessonProgress = await db.select().from(lessonProgress).where(eq(lessonProgress.userId, id));

  return JSON.stringify(
    {
      profile,
      purchases: userPurchases,
      subscriptions: userSubscriptions,
      lessonProgress: userLessonProgress,
    },
    null,
    2,
  );
}

/**
 * Hard-deletes a user and every row that references them. There are no
 * database-level foreign keys (see db/schema.ts), so each table is cleared
 * explicitly, in one transaction, before the user row itself.
 */
export async function hardDeleteUserAction(id: number) {
  await requireAdmin();

  await db.transaction(async (tx) => {
    await tx.delete(lessonProgress).where(eq(lessonProgress.userId, id));
    await tx.delete(purchases).where(eq(purchases.userId, id));
    await tx.delete(subscriptions).where(eq(subscriptions.userId, id));
    await tx.delete(passwordTokens).where(eq(passwordTokens.userId, id));
    await tx.delete(users).where(eq(users.id, id));
  });

  redirect("/admin/users");
}
