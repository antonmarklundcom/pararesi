import { NextResponse } from "next/server";
import { buildHealthReport } from "@/lib/health";

export const dynamic = "force-dynamic";

/**
 * Uptime-monitor endpoint (docs/04 §4). Unauthenticated on purpose, so it
 * carries nothing an anonymous caller shouldn't see: whether the database
 * answers, how many migrations are applied, and the deployed commit. No env
 * values, no counts of users or leads, no error strings from the database.
 *
 * The body always reports `db` as "up" or "down"; the status code is 503 when
 * it's down, because a monitor that only ever sees 200 will never page anyone.
 */
export async function GET() {
  const report = await buildHealthReport();
  return NextResponse.json(report, {
    status: report.ok ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
