import type { ReactNode } from "react";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { PAST_DUE_STATUS, isPastDue } from "@/lib/subscription-status";
import { PortalNav } from "@/components/portal/PortalNav";
import { PastDueBanner } from "@/components/portal/PastDueBanner";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  // One indexed lookup on every portal page. The banner has to live in the
  // layout rather than the account page: a member whose card failed is far
  // more likely to be reading a lesson than checking their account.
  const [pastDueSubscription] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.status, PAST_DUE_STATUS)));

  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-60 shrink-0 border-r border-brand-navy-900/10 p-6 md:block">
        <Link href="/" className="mb-8 block text-sm font-semibold text-brand-navy-900">
          Paraguay Residency Guide
        </Link>
        <PortalNav />
      </aside>
      <main className="flex-1 p-8">
        {isPastDue(pastDueSubscription) ? <PastDueBanner /> : null}
        {children}
      </main>
    </div>
  );
}
