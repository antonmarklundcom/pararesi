import { NextResponse } from "next/server";
import { fetchSubscriptionResource, productKeyForVariantId } from "@/lib/lemonsqueezy";
import { createPasswordToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { verifySignature, type LemonSqueezyPayload } from "@/lib/ls-webhook";
import { processWebhook } from "@/lib/webhook/handlers";
import { drizzleWebhookStore } from "@/lib/webhook/drizzle-store";
import type { WebhookDeps } from "@/lib/webhook/types";

export const dynamic = "force-dynamic";

/**
 * Production wiring for the handlers. Everything the state machine touches —
 * database, email, tokens, the Lemon Squeezy API — comes through here, which
 * is what lets tests/webhook-state-machine.test.ts exercise the same code
 * against in-memory doubles.
 */
function webhookDeps(): WebhookDeps {
  return {
    store: drizzleWebhookStore,
    sendEmail,
    createPasswordToken,
    productKeyForVariantId,
    fetchSubscription: fetchSubscriptionResource,
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
  };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const signatureHeader = request.headers.get("x-signature");

  if (!secret || !verifySignature(rawBody, signatureHeader, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: LemonSqueezyPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const result = await processWebhook(payload, webhookDeps());

  if (result.status === "duplicate") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // Always 200 (except a bad signature) so Lemon Squeezy doesn't endlessly retry;
  // failures are visible in the webhookEvents.error column for follow-up.
  // TODO(B3): return 500 on a transient failure so Lemon Squeezy retries.
  return NextResponse.json({ ok: true });
}
