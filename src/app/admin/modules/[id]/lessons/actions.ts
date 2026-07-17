"use server";

import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { lessons, lessonProgress } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

function lessonValuesFromFormData(moduleId: number, formData: FormData) {
  return {
    moduleId,
    slug: String(formData.get("slug") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    contentMd: String(formData.get("contentMd") ?? ""),
    videoUrl: String(formData.get("videoUrl") ?? "") || null,
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    status: String(formData.get("status") ?? "draft") as "draft" | "published",
  };
}

export async function createLessonAction(moduleId: number, formData: FormData) {
  await requireAdmin();
  await db.insert(lessons).values(lessonValuesFromFormData(moduleId, formData));
  redirect(`/admin/modules/${moduleId}/lessons`);
}

export async function updateLessonAction(moduleId: number, lessonId: number, formData: FormData) {
  await requireAdmin();
  await db
    .update(lessons)
    .set(lessonValuesFromFormData(moduleId, formData))
    .where(and(eq(lessons.id, lessonId), eq(lessons.moduleId, moduleId)));
  redirect(`/admin/modules/${moduleId}/lessons`);
}

export async function deleteLessonAction(moduleId: number, lessonId: number) {
  await requireAdmin();
  await db.delete(lessonProgress).where(eq(lessonProgress.lessonId, lessonId));
  await db.delete(lessons).where(and(eq(lessons.id, lessonId), eq(lessons.moduleId, moduleId)));
  redirect(`/admin/modules/${moduleId}/lessons`);
}
