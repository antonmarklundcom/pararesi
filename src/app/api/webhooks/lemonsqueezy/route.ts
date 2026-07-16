import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Raw-body HMAC verification + event handling land in Phase 3 (doc 02 §5).
export async function POST() {
  return NextResponse.json({ received: true }, { status: 200 });
}
