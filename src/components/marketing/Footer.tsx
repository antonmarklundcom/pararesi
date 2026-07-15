import Link from "next/link";
import { Container } from "@/components/ui/Container";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/guide", label: "The Guide" },
      { href: "/pricing", label: "Pricing" },
      { href: "/blog", label: "Blog" },
    ],
  },
  {
    title: "Company",
    links: [{ href: "/about", label: "About" }],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/refund-policy", label: "Refund Policy" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-brand-navy-900/10 bg-brand-green-50">
      <Container className="grid gap-10 py-14 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <p className="text-sm font-semibold text-brand-navy-900">Paraguay Residency Guide</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-brand-navy-900/70">
            An independent information product. We are not a law firm, and nothing on this
            site is legal or immigration advice.
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-navy-900/50">
              {column.title}
            </p>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-brand-navy-900/70 hover:text-brand-navy-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
      <Container className="border-t border-brand-navy-900/10 py-6">
        <p className="text-xs text-brand-navy-900/50">
          &copy; {new Date().getFullYear()} Paraguay Residency Guide. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
