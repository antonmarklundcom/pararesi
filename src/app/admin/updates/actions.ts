"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { updatesPosts } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

function updatesPostValuesFromFormData(formData: FormData) {
  const publishedAtRaw = String(formData.get("publishedAt") ?? "");
  return {
    title: String(formData.get("title") ?? "").trim(),
    contentMd: String(formData.get("contentMd") ?? ""),
    minTier: String(formData.get("minTier") ?? "guide") as "guide" | "insider",
    publishedAt: publishedAtRaw ? new Date(publishedAtRaw) : null,
    status: String(formData.get("status") ?? "draft") as "draft" | "published",
  };
}

export async function createUpdatesPostAction(formData: FormData) {
  await requireAdmin();
  await db.insert(updatesPosts).values(updatesPostValuesFromFormData(formData));
  redirect("/admin/updates");
}

export async function updateUpdatesPostAction(id: number, formData: FormData) {
  await requireAdmin();
  await db.update(updatesPosts).set(updatesPostValuesFromFormData(formData)).where(eq(updatesPosts.id, id));
  redirect("/admin/updates");
}

export async function deleteUpdatesPostAction(id: number) {
  await requireAdmin();
  await db.delete(updatesPosts).where(eq(updatesPosts.id, id));
  redirect("/admin/updates");
}
