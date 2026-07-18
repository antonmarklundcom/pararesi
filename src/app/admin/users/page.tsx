import type { Metadata } from "next";
import { like } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { DataTable } from "@/components/admin/DataTable";

export const metadata: Metadata = {
  title: "Admin · Users",
};

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const rows = await db
    .select()
    .from(users)
    .where(q ? like(users.email, `%${q}%`) : undefined);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">Users</h1>
      <form className="mt-4" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by email..."
          className="w-full max-w-sm rounded-lg border border-brand-navy-900/20 px-3 py-2 text-sm focus:border-brand-green-600 focus:outline-none"
        />
      </form>
      <div className="mt-6">
        <DataTable
          rows={rows}
          editHref={(row) => `/admin/users/${row.id}/edit`}
          columns={[
            { header: "Email", render: (r) => r.email },
            { header: "Name", render: (r) => r.name ?? "—" },
            { header: "Role", render: (r) => r.role },
            { header: "Tier", render: (r) => r.tier },
          ]}
        />
      </div>
    </div>
  );
}
