import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Progress %, latest updates, and the guide->insider upsell card land in Phase 4.
export const dynamic = "force-dynamic";

export default function PortalDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">Dashboard</h1>
      <p className="mt-2 text-sm text-brand-navy-900/60">
        [PLACEHOLDER] Progress, continue-where-you-left-off, and updates feed land in Phase 4.
      </p>
    </div>
  );
}
