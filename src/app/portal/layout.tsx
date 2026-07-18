import type { ReactNode } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PortalNav } from "@/components/portal/PortalNav";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  await requireUser();

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
