import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { modules, lessons } from "@/db/schema";
import { DataTable } from "@/components/admin/DataTable";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Admin · Lessons",
};

export const dynamic = "force-dynamic";

export default async function ModuleLessonsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const moduleId = Number(id);
  const [module] = await db.select().from(modules).where(eq(modules.id, moduleId));
  if (!module) notFound();

  const rows = (await db.select().from(lessons).where(eq(lessons.moduleId, moduleId))).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  return (
    <div>
      <Link href="/admin/modules" className="text-sm text-brand-navy-900/60 hover:text-brand-navy-900">
        &larr; Modules
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-navy-950">Lessons — {module.title}</h1>
        <ButtonLink href={`/admin/modules/${moduleId}/lessons/new`} className="px-4 py-2 text-sm">
          New lesson
        </ButtonLink>
      </div>
      <div className="mt-6">
        <DataTable
          rows={rows}
          editHref={(row) => `/admin/modules/${moduleId}/lessons/${row.id}/edit`}
          columns={[
            { header: "Title", render: (r) => r.title },
            { header: "Slug", render: (r) => r.slug },
            { header: "Status", render: (r) => r.status },
            { header: "Order", render: (r) => r.sortOrder },
          ]}
        />
      </div>
    </div>
  );
}
