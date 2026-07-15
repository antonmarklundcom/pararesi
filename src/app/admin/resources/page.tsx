import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin · Resources",
};

export const dynamic = "force-dynamic";

export default function AdminResourcesPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">Resources</h1>
      <p className="mt-2 text-sm text-brand-navy-900/60">
        [PLACEHOLDER] CRUD lands in Phase 5.
      </p>
    </div>
  );
}
