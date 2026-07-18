"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { resources } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

function resourceValuesFromFormData(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "") || null,
    fileUrl: String(formData.get("fileUrl") ?? "").trim(),
    minTier: String(formData.get("minTier") ?? "guide") as "guide" | "insider",
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    status: String(formData.get("status") ?? "draft") as "draft" | "published",
  };
}

export async function createResourceAction(formData: FormData) {
  await requireAdmin();
  await db.insert(resources).values(resourceValuesFromFormData(formData));
  redirect("/admin/resources");
}

export async function updateResourceAction(id: number, formData: FormData) {
  await requireAdmin();
  await db.update(resources).set(resourceValuesFromFormData(formData)).where(eq(resources.id, id));
  redirect("/admin/resources");
}

export async function deleteResourceAction(id: number) {
  await requireAdmin();
  await db.delete(resources).where(eq(resources.id, id));
  redirect("/admin/resources");
}
