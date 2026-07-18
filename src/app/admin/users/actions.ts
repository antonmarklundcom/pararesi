"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
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
