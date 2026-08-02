"use server";

import { revalidatePath } from "next/cache";
import {
  replayWebhookEventById,
  getWebhookEventRawPayload,
  type ReplayResult,
} from "@/lib/webhook/admin";

/** Server action behind the admin "replay" button on /admin/webhooks. */
export async function replayWebhookEventAction(eventId: number): Promise<ReplayResult> {
  const result = await replayWebhookEventById(eventId);
  revalidatePath("/admin/webhooks");
  return result;
}

/** Fetches a single event's raw payload on demand, for the row's expand toggle. */
export async function getWebhookEventRawPayloadAction(eventId: number): Promise<string | null> {
  return getWebhookEventRawPayload(eventId);
}
