import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, purchases, subscriptions } from "@/db/schema";
import { EntityForm } from "@/components/admin/EntityForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { updateUserAction, hardDeleteUserAction } from "../../actions";
import { ExportUserJsonButton } from "../../ExportUserJsonButton";

export const metadata: Metadata = {
  title: "Admin · Edit user",
};

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) notFound();

  const userPurchases = await db.select().from(purchases).where(eq(purchases.userId, userId));
  const userSubscriptions = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-brand-navy-950">{user.email}</h1>
        <p className="mt-1 text-sm text-brand-navy-900/60">
          {user.name ?? "—"} · joined {new Date(user.createdAt).toLocaleDateString()}
        </p>
        <div className="mt-3 flex gap-4">
          <ExportUserJsonButton userId={user.id} email={user.email} />
          <DeleteButton
            action={hardDeleteUserAction.bind(null, user.id)}
            label="Delete user (GDPR)"
          />
        </div>
      </div>

      <EntityForm
        action={updateUserAction.bind(null, user.id)}
        initialValues={user}
        submitLabel="Save"
        fields={[
          {
            type: "select",
            name: "role",
            label: "Role",
            options: [
              { value: "member", label: "Member" },
              { value: "admin", label: "Admin" },
            ],
          },
          {
            type: "select",
            name: "tier",
            label: "Tier",
            options: [
              { value: "none", label: "None" },
              { value: "guide", label: "Guide" },
              { value: "insider", label: "Insider" },
            ],
          },
          { type: "datetime", name: "tierExpiresAt", label: "Tier expires at (blank = lifetime)" },
        ]}
      />

      <div>
        <p className="text-sm font-medium text-brand-navy-900">Purchases (read-only)</p>
        <div className="mt-3 space-y-2">
          {userPurchases.length === 0 ? (
            <p className="text-sm text-brand-navy-900/60">No purchases.</p>
          ) : (
            userPurchases.map((p) => (
              <div key={p.id} className="rounded-lg border border-brand-navy-900/10 px-4 py-2 text-sm">
                {p.productKey} · ${(p.amountUsd / 100).toFixed(2)} · {p.status} ·{" "}
                {new Date(p.createdAt).toLocaleDateString()}
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-brand-navy-900">Subscriptions (read-only)</p>
        <div className="mt-3 space-y-2">
          {userSubscriptions.length === 0 ? (
            <p className="text-sm text-brand-navy-900/60">No subscriptions.</p>
          ) : (
            userSubscriptions.map((s) => (
              <div key={s.id} className="rounded-lg border border-brand-navy-900/10 px-4 py-2 text-sm">
                {s.status} · renews {s.renewsAt ? new Date(s.renewsAt).toLocaleDateString() : "—"}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
