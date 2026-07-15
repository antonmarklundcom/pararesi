import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot password",
};

// Anti-enumeration flow ("if that email exists...") + rate limiting land in Phase 2.
export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-lg font-semibold text-brand-navy-950">Forgot password</h1>
      <p className="mt-2 text-sm text-brand-navy-900/60">
        [PLACEHOLDER] Reset-request form lands in Phase 2.
      </p>
    </div>
  );
}
