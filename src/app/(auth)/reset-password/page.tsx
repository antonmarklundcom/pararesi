import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset password",
};

// Consumes a hashed, single-use passwordTokens row (purpose='reset'). Phase 2.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  await searchParams;
  return (
    <div>
      <h1 className="text-lg font-semibold text-brand-navy-950">Reset password</h1>
      <p className="mt-2 text-sm text-brand-navy-900/60">
        [PLACEHOLDER] Token verification + new-password form lands in Phase 2.
      </p>
    </div>
  );
}
