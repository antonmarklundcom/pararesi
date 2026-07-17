import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-lg font-semibold text-brand-navy-950">Forgot password</h1>
      <p className="mt-2 text-sm text-brand-navy-900/60">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
