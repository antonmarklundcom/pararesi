"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leads, leadTokens } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

/**
 * Removes a lead and any outstanding confirmation tokens. This is the v1
 * answer to "please take me off your list / delete my data" until self-service
 * unsubscribe exists — see docs/07 C2.
 */
export async function deleteLeadAction(id: number) {
  await requireAdmin();
  await db.delete(leadTokens).where(eq(leadTokens.leadId, id));
  await db.delete(leads).where(eq(leads.id, id));
  redirect("/admin/leads");
}
