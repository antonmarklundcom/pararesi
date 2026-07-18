"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { lessonProgress } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function toggleLessonComplete(lessonId: number, modulePath: string) {
  const user = await requireUser();

  const [existing] = await db
    .select()
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, user.id), eq(lessonProgress.lessonId, lessonId)));

  if (existing) {
    await db
      .delete(lessonProgress)
      .where(and(eq(lessonProgress.userId, user.id), eq(lessonProgress.lessonId, lessonId)));
  } else {
    await db.insert(lessonProgress).values({ userId: user.id, lessonId });
  }

  revalidatePath(modulePath);
  revalidatePath("/portal");
}
