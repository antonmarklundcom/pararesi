import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account",
};

// Name/email, change password, purchases list, and LS customer-portal link land in Phase 4.
export const dynamic = "force-dynamic";

export default function PortalAccountPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">Account</h1>
      <p className="mt-2 text-sm text-brand-navy-900/60">
        [PLACEHOLDER] Account details, password change, and purchase history land in Phase 4.
      </p>
    </div>
  );
}
