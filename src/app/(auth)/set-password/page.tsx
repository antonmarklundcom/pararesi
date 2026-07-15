import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set your password",
};

// Consumes a hashed, single-use passwordTokens row (purpose='set') sent after
// a Lemon Squeezy purchase creates the user. Phase 2.
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  await searchParams;
  return (
    <div>
      <h1 className="text-lg font-semibold text-brand-navy-950">Set your password</h1>
      <p className="mt-2 text-sm text-brand-navy-900/60">
        [PLACEHOLDER] Token verification + set-password form lands in Phase 2.
      </p>
    </div>
  );
}
