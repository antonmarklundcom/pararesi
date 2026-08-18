import { env } from "@/config/env";
import { fetchSubscriptionResource, productKeyForVariantId } from "@/lib/lemonsqueezy";
import { createPasswordToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { drizzleWebhookStore } from "./drizzle-store";
import type { WebhookDeps } from "./types";

/**
 * Production wiring for the webhook handlers. Everything the state machine
 * touches — database, email, tokens, the Lemon Squeezy API — comes through
 * here, which is what lets tests exercise the same code against in-memory
 * doubles. Shared by the webhook route and the admin replay action so a
 * replay behaves exactly like the original delivery.
 */
export function productionWebhookDeps(): WebhookDeps {
  return {
    store: drizzleWebhookStore,
    sendEmail,
    createPasswordToken,
    productKeyForVariantId,
    fetchSubscription: fetchSubscriptionResource,
    appUrl: env.appUrl(),
  };
}
