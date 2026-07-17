"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { modules, lessons } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

function moduleValuesFromFormData(formData: FormData) {
  return {
    slug: String(formData.get("slug") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "") || null,
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    minTier: String(formData.get("minTier") ?? "guide") as "guide" | "insider",
    status: String(formData.get("status") ?? "draft") as "draft" | "published",
  };
}

export async function createModuleAction(formData: FormData) {
  await requireAdmin();
  await db.insert(modules).values(moduleValuesFromFormData(formData));
  redirect("/admin/modules");
}

export async function updateModuleAction(id: number, formData: FormData) {
  await requireAdmin();
  await db.update(modules).set(moduleValuesFromFormData(formData)).where(eq(modules.id, id));
  redirect("/admin/modules");
}

export async function deleteModuleAction(id: number) {
  await requireAdmin();
  // No DB-level FK/cascade — delete lessons first to avoid orphaning them.
  await db.delete(lessons).where(eq(lessons.moduleId, id));
  await db.delete(modules).where(eq(modules.id, id));
  redirect("/admin/modules");
}
