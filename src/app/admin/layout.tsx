import type { ReactNode } from "react";
import Link from "next/link";

const links = [
  { href: "/admin/modules", label: "Modules & Lessons" },
  { href: "/admin/resources", label: "Resources" },
  { href: "/admin/updates", label: "Updates" },
  { href: "/admin/blog", label: "Blog" },
  { href: "/admin/users", label: "Users" },
];

// requireAdmin() gate lands in Phase 2.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-60 shrink-0 border-r border-brand-navy-900/10 p-6 md:block">
        <Link href="/" className="mb-8 block text-sm font-semibold text-brand-navy-900">
          Admin
        </Link>
        <nav className="flex flex-col gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm text-brand-navy-900/70 hover:bg-brand-green-50 hover:text-brand-navy-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
