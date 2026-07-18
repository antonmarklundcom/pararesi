import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div>
      <h1 className="text-lg font-semibold text-brand-navy-950">Log in</h1>
      <div className="mt-6">
        <LoginForm next={next ?? null} />
      </div>
    </div>
  );
}
