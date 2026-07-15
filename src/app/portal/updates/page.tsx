import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Updates",
};

// Tier-gated law/fee updates feed lands in Phase 4.
export const dynamic = "force-dynamic";

export default function PortalUpdatesPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">Updates</h1>
      <p className="mt-2 text-sm text-brand-navy-900/60">
        [PLACEHOLDER] Law &amp; fee updates feed lands in Phase 4.
      </p>
    </div>
  );
}
