import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resources",
};

// Tier-filtered downloads/templates land in Phase 4.
export const dynamic = "force-dynamic";

export default function PortalResourcesPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">Resources</h1>
      <p className="mt-2 text-sm text-brand-navy-900/60">
        [PLACEHOLDER] Tier-filtered downloads land in Phase 4.
      </p>
    </div>
  );
}
