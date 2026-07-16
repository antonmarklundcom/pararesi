import Link from "next/link";

const PORTAL_NAV = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/resources", label: "Resources" },
  { href: "/portal/updates", label: "Updates" },
  { href: "/portal/account", label: "Account" },
];

export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // requireUser() gating lands in Phase 2 — this layout is a Phase 0 stub.
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <span className="text-lg font-semibold text-primary">Portal</span>
          <nav className="flex gap-6 text-sm font-medium">
            {PORTAL_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-foreground/80 transition-colors hover:text-primary"
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
