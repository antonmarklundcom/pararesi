import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in",
};

// iron-session + bcrypt login form and server action land in Phase 2.
export default function LoginPage() {
  return (
    <div>
      <h1 className="text-lg font-semibold text-brand-navy-950">Log in</h1>
      <p className="mt-2 text-sm text-brand-navy-900/60">
        [PLACEHOLDER] Login form lands in Phase 2.
      </p>
    </div>
  );
}
