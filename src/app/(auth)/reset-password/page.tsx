import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset password",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-brand-navy-950">Reset password</h1>
        <p className="mt-2 text-sm text-brand-navy-900/60">
          This link is missing its token.{" "}
          <Link href="/forgot-password" className="text-brand-green-600 hover:underline">
            Request a new one
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-brand-navy-950">Reset password</h1>
      <div className="mt-6">
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
