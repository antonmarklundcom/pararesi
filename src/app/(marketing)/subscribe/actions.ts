"use server";

import { appUrl, sendLeadEmail } from "@/lib/lead-email";
import { createLeadConfirmToken } from "@/lib/lead-tokens";
import {
  isPlausibleEmail,
  leadRateLimitKeys,
  normalizeEmail,
  normalizeSource,
  upsertLead,
} from "@/lib/leads";
import { rateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";

// Same shape as the message every other public email form returns: identical
// whether or not the address is already on the list, so the form can't be used
// to test who has subscribed.
const GENERIC_MESSAGE = "Check your inbox — we've sent a link to confirm your email.";
const INVALID_EMAIL_ERROR = "That doesn't look like a valid email address.";

export type SubscribeState = { ok: true; message: string } | { ok: false; error: string } | undefined;

export async function subscribeAction(
  _prevState: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  const email = normalizeEmail(formData.get("email"));
  const source = normalizeSource(formData.get("source"));

  if (!isPlausibleEmail(email)) {
    return { ok: false, error: INVALID_EMAIL_ERROR };
  }

  const ip = await getClientIp();
  const { emailKey, ipKey } = leadRateLimitKeys(email, ip);
  // Deliberately generic on rate limit, like forgotPasswordAction: a caller
  // hammering the form learns nothing from the response.
  if (!rateLimit(emailKey, 3, 60 * 60 * 1000) || !rateLimit(ipKey, 10, 60 * 60 * 1000)) {
    return { ok: true, message: GENERIC_MESSAGE };
  }

  const { lead, status } = await upsertLead(email, source);

  // An already-confirmed subscriber gets no mail — otherwise this public form
  // would be a way to send them an email on demand.
  if (status !== "confirmed") {
    const token = await createLeadConfirmToken(lead.id);
    const confirmUrl = `${appUrl()}/subscribe/confirm?token=${token}`;
    await sendLeadEmail({
      leadId: lead.id,
      to: lead.email,
      template: "confirm-subscription",
      data: { confirmUrl, name: "" },
    });
  }

  return { ok: true, message: GENERIC_MESSAGE };
}
