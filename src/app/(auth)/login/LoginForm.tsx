"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "./actions";
import { Button } from "@/components/ui/Button";

export function LoginForm({ next }: { next: string | null }) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-brand-navy-900">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-brand-navy-900/20 px-3 py-2 text-sm focus:border-brand-green-600 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-brand-navy-900">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-brand-navy-900/20 px-3 py-2 text-sm focus:border-brand-green-600 focus:outline-none"
        />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Logging in..." : "Log in"}
      </Button>
      <p className="text-center text-sm text-brand-navy-900/60">
        <Link href="/forgot-password" className="hover:text-brand-navy-900">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}
