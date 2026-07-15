import Link from "next/link";

const links = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/course", label: "Course" },
  { href: "/portal/resources", label: "Resources" },
  { href: "/portal/updates", label: "Updates" },
  { href: "/portal/account", label: "Account" },
];

export function PortalNav() {
  return (
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
  );
}
