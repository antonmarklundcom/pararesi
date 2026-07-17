"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

function blogPostValuesFromFormData(formData: FormData) {
  const publishedAtRaw = String(formData.get("publishedAt") ?? "");
  return {
    slug: String(formData.get("slug") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    excerpt: String(formData.get("excerpt") ?? "") || null,
    contentMd: String(formData.get("contentMd") ?? ""),
    metaTitle: String(formData.get("metaTitle") ?? "") || null,
    metaDescription: String(formData.get("metaDescription") ?? "") || null,
    publishedAt: publishedAtRaw ? new Date(publishedAtRaw) : null,
    status: String(formData.get("status") ?? "draft") as "draft" | "published",
  };
}

export async function createBlogPostAction(formData: FormData) {
  await requireAdmin();
  await db.insert(blogPosts).values(blogPostValuesFromFormData(formData));
  redirect("/admin/blog");
}

export async function updateBlogPostAction(id: number, formData: FormData) {
  await requireAdmin();
  await db.update(blogPosts).set(blogPostValuesFromFormData(formData)).where(eq(blogPosts.id, id));
  redirect("/admin/blog");
}

export async function deleteBlogPostAction(id: number) {
  await requireAdmin();
  await db.delete(blogPosts).where(eq(blogPosts.id, id));
  redirect("/admin/blog");
}
