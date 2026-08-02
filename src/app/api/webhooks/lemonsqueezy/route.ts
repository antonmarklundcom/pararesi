import { NextResponse } from "next/server";
import { verifySignature, type LemonSqueezyPayload } from "@/lib/ls-webhook";
import { processWebhook } from "@/lib/webhook/handlers";
import { productionWebhookDeps } from "@/lib/webhook/deps";

export const dynamic = "force-dynamic";

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

  const result = await processWebhook(payload, productionWebhookDeps());

  // A redelivery of an event we already applied: nothing to do, and nothing
  // for Lemon Squeezy to retry.
  if (result.status === "duplicate") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // A handler failure is usually transient — a Lemon Squeezy API blip while
  // fetching a renewed subscription, a database hiccup — and a dropped webhook
  // means a customer who paid and got nothing. 500 puts the delivery back on
  // Lemon Squeezy's retry schedule. The event is already logged with its error
  // either way, so a delivery that exhausts the retries is still recoverable
  // by hand via replayWebhookEvent.
  if (result.status === "failed") {
    console.error(`[lemonsqueezy webhook] ${payload.meta?.event_name} failed:`, result.error);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
