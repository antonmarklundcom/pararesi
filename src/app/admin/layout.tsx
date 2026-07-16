import Link from "next/link";

const ADMIN_NAV = [
  { href: "/admin/modules", label: "Modules" },
  { href: "/admin/lessons", label: "Lessons" },
  { href: "/admin/resources", label: "Resources" },
  { href: "/admin/updates", label: "Updates" },
  { href: "/admin/blog", label: "Blog" },
  { href: "/admin/users", label: "Users" },
];

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // requireAdmin() gating lands in Phase 2 — this layout is a Phase 0 stub.
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-secondary text-secondary-foreground">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <span className="text-lg font-semibold">Admin</span>
          <nav className="flex gap-6 text-sm font-medium">
            {ADMIN_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-secondary-foreground/80 transition-colors hover:text-secondary-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
