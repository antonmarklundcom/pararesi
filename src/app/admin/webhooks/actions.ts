"use server";

import { revalidatePath } from "next/cache";
import { replayWebhookEventById, type ReplayResult } from "@/lib/webhook/admin";

/**
 * Server action behind the admin "replay" button. The page that calls it is
 * not built yet (left to the next session); the listing query it will also
 * need is `listRecentWebhookEvents` in @/lib/webhook/admin, which a server
 * component can await directly.
 */
export async function replayWebhookEventAction(eventId: number): Promise<ReplayResult> {
  const result = await replayWebhookEventById(eventId);
  revalidatePath("/admin/webhooks");
  return result;
}
