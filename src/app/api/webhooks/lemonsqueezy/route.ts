import { NextResponse } from "next/server";

// Raw-body HMAC verification, webhookEvents idempotency, and the full
// order/subscription state machine land in Phase 3 (docs/02-architecture.md §5).
// This stub exists only so the route shape is in place from Phase 0.
export async function POST() {
  return NextResponse.json({ error: "not implemented" }, { status: 501 });
}
