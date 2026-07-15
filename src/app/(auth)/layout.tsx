import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-brand-green-50 px-6 py-24">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 block text-center text-sm font-semibold text-brand-navy-900"
        >
          Paraguay Residency Guide
        </Link>
        <div className="rounded-2xl border border-brand-navy-900/10 bg-white p-8 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
