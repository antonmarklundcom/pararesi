import type { ReactNode } from "react";
import Link from "next/link";
import { PortalNav } from "@/components/portal/PortalNav";

// requireUser() gate lands in Phase 2; middleware.ts is UX-only per docs/02-architecture.md §3.
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-60 shrink-0 border-r border-brand-navy-900/10 p-6 md:block">
        <Link href="/" className="mb-8 block text-sm font-semibold text-brand-navy-900">
          Paraguay Residency Guide
        </Link>
        <PortalNav />
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
