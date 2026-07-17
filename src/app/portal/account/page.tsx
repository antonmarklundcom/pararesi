import type { Metadata } from "next";
import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { purchases, subscriptions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { manageSubscriptionAction } from "./actions";

export const metadata: Metadata = {
  title: "Account",
};

export const dynamic = "force-dynamic";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "on_trial", "past_due"];

export default async function PortalAccountPage() {
  const user = await requireUser();

  const userPurchases = await db
    .select()
    .from(purchases)
    .where(eq(purchases.userId, user.id))
    .orderBy(desc(purchases.createdAt));

  const [activeSubscription] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), inArray(subscriptions.status, ACTIVE_SUBSCRIPTION_STATUSES)));

  return (
    <div className="max-w-xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-brand-navy-950">Account</h1>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-brand-navy-900/60">Name</dt>
            <dd className="text-brand-navy-950">{user.name ?? "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-brand-navy-900/60">Email</dt>
            <dd className="text-brand-navy-950">{user.email}</dd>
          </div>
        </dl>
      </div>

      {activeSubscription ? (
        <div>
          <p className="text-sm font-medium text-brand-navy-900">Subscription</p>
          <p className="mt-1 text-sm text-brand-navy-900/60">Status: {activeSubscription.status}</p>
          <form action={manageSubscriptionAction} className="mt-3">
            <button
              type="submit"
              className="text-sm font-medium text-brand-green-600 hover:text-brand-green-700"
            >
              Manage subscription &rarr;
            </button>
          </form>
        </div>
      ) : null}

      <div>
        <p className="text-sm font-medium text-brand-navy-900">Purchases</p>
        <div className="mt-3 space-y-2">
          {userPurchases.length === 0 ? (
            <p className="text-sm text-brand-navy-900/60">No purchases yet.</p>
          ) : (
            userPurchases.map((purchase) => (
              <div
                key={purchase.id}
                className="flex items-center justify-between rounded-lg border border-brand-navy-900/10 px-4 py-2 text-sm"
              >
                <span className="text-brand-navy-950">{purchase.productKey}</span>
                <span className="text-brand-navy-900/60">
                  ${(purchase.amountUsd / 100).toFixed(2)} · {purchase.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-brand-navy-900">Change password</p>
        <div className="mt-3">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
