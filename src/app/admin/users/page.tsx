import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin · Users",
};

// List, search by email, tier override + tierExpiresAt edit land in Phase 5.
export const dynamic = "force-dynamic";

export default function AdminUsersPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">Users</h1>
      <p className="mt-2 text-sm text-brand-navy-900/60">
        [PLACEHOLDER] User list + tier override lands in Phase 5.
      </p>
    </div>
  );
}
