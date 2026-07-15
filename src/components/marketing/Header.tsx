import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";

const navLinks = [
  { href: "/guide", label: "The Guide" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
];

export function Header() {
  return (
    <header className="border-b border-brand-navy-900/10 bg-white/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-tight text-brand-navy-900">
          Paraguay Residency Guide
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-brand-navy-800/80 transition-colors hover:text-brand-navy-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-brand-navy-800/80 hover:text-brand-navy-900">
            Log in
          </Link>
          <ButtonLink href="/guide" className="px-5 py-2 text-sm">
            Get the guide
          </ButtonLink>
        </div>
      </Container>
    </header>
  );
}
