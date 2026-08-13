import { NextResponse } from "next/server";
import crypto from "crypto";
import { runNurtureBatch } from "@/lib/nurture-run";

export const dynamic = "force-dynamic";

/**
 * Runs the lead nurture sequence. Meant to be hit once a day by Hostinger's
 * cron (`curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET"
 * https://…/api/cron/nurture`) — the stack has a single web process and no job
 * runner, so a protected endpoint on a schedule is the mechanism that fits.
 *
 * Running it more often than daily is harmless: eligibility is computed from
 * `leads.confirmed_at` and the `lead_emails` rows, so a second run in the same
 * day finds nothing left to send.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed rather than run unauthenticated. Deliberately the same body
    // as a bad token: an unconfigured deployment shouldn't be discoverable.
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const provided = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!timingSafeEqual(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runNurtureBatch();

  // A partial failure is reported as 500 so a monitored cron job shows red,
  // but the emails that did go out are already recorded and won't repeat.
  return NextResponse.json(result, { status: result.failed > 0 ? 500 : 200 });
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}
