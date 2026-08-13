"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leads, leadTokens } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

/**
 * Removes a lead and any outstanding tokens. Self-service unsubscribe
 * (/unsubscribe) covers "stop mailing me"; this is the harder erasure — "delete
 * my data" — which still needs a human.
 */
export async function deleteLeadAction(id: number) {
  await requireAdmin();
  await db.delete(leadTokens).where(eq(leadTokens.leadId, id));
  await db.delete(leads).where(eq(leads.id, id));
  redirect("/admin/leads");
}
