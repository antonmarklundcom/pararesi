import { env } from "@/config/env";
import { sendEmail, type EmailTemplate } from "@/lib/email";
import { createLeadUnsubscribeToken, type LeadTokenStore, drizzleLeadTokenStore } from "@/lib/lead-tokens";

/** Public base URL of the app. Same fallback the rest of the app uses in dev. */
export function appUrl(): string {
  return env.appUrl();
}

export function unsubscribeUrlForToken(rawToken: string): string {
  return `${appUrl()}/unsubscribe?token=${rawToken}`;
}

/**
 * Sends an email to a marketing lead with a working unsubscribe link attached.
 *
 * All lead mail goes through here rather than calling sendEmail directly: the
 * unsubscribe token is minted per send, so every message in a lead's history
 * carries a link that still works, and no lead template can ship without one.
 */
export async function sendLeadEmail({
  leadId,
  to,
  template,
  data = {},
  tokenStore = drizzleLeadTokenStore,
}: {
  leadId: number;
  to: string;
  template: EmailTemplate;
  data?: Record<string, string>;
  tokenStore?: LeadTokenStore;
}): Promise<void> {
  const token = await createLeadUnsubscribeToken(leadId, tokenStore);

  await sendEmail({
    to,
    template,
    data: { ...data, unsubscribeUrl: unsubscribeUrlForToken(token) },
  });
}
