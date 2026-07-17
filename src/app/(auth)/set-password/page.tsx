import type { Metadata } from "next";
import { SetPasswordForm } from "./SetPasswordForm";

export const metadata: Metadata = {
  title: "Set your password",
};

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-brand-navy-950">Set your password</h1>
        <p className="mt-2 text-sm text-brand-navy-900/60">
          This link is missing its token. Check the email from your purchase, or contact support.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-brand-navy-950">Set your password</h1>
      <p className="mt-2 text-sm text-brand-navy-900/60">
        Welcome! Choose a password to access your account.
      </p>
      <div className="mt-6">
        <SetPasswordForm token={token} />
      </div>
    </div>
  );
}
