"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { updatesPosts, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/lead-email";
import type { Tier } from "@/lib/tiers";
import {
  canNotifyAboutUpdate,
  updateNotifyRecipients,
  type NotifiablePost,
} from "@/lib/update-notify";

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
  // Deliberately doesn't touch notifiedAt: editing a post that already went out
  // must not arm a second notification.
  await db.update(updatesPosts).set(updatesPostValuesFromFormData(formData)).where(eq(updatesPosts.id, id));
  redirect("/admin/updates");
}

export async function deleteUpdatesPostAction(id: number) {
  await requireAdmin();
  await db.delete(updatesPosts).where(eq(updatesPosts.id, id));
  redirect("/admin/updates");
}

/**
 * C4: emails the members entitled to read this post that it exists.
 *
 * `notifiedAt` is stamped before any mail is attempted, so a crash mid-batch
 * (or an impatient second click) can't restart the send. The cost of that
 * ordering is that a failure means some members miss one notification, which is
 * much cheaper than mailing the whole list twice.
 */
export async function notifyUpdatesPostAction(id: number) {
  await requireAdmin();

  const [row] = await db.select().from(updatesPosts).where(eq(updatesPosts.id, id));
  if (!row) redirect("/admin/updates");

  const post: NotifiablePost = {
    id: row.id,
    title: row.title,
    minTier: row.minTier as Tier,
    status: row.status,
    publishedAt: row.publishedAt ?? null,
    notifiedAt: row.notifiedAt ?? null,
  };

  const now = new Date();
  if (!canNotifyAboutUpdate(post, now).ok) redirect("/admin/updates");

  await db.update(updatesPosts).set({ notifiedAt: now }).where(eq(updatesPosts.id, id));

  const memberRows = await db.select().from(users);
  const recipients = updateNotifyRecipients(
    memberRows.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      tier: user.tier as Tier,
      tierExpiresAt: user.tierExpiresAt ?? null,
      updateEmailsEnabled: user.updateEmailsEnabled,
    })),
    post,
    now,
  );

  const updatesUrl = `${appUrl()}/portal/updates`;
  // Every notification carries the way out of it, the same way lead mail does.
  const accountUrl = `${appUrl()}/portal/account`;
  for (const recipient of recipients) {
    try {
      await sendEmail({
        to: recipient.email,
        template: "update-published",
        data: { title: post.title, name: recipient.name ?? "", updatesUrl, accountUrl },
      });
    } catch (error) {
      // One bad address shouldn't stop the rest of the list.
      console.error(`[update-notify] post ${post.id} to user ${recipient.id} failed:`, error);
    }
  }

  revalidatePath("/admin/updates");
  redirect("/admin/updates");
}
