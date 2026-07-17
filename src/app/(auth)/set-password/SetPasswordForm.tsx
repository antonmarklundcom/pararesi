"use client";

import { useActionState } from "react";
import { setPasswordAction } from "./actions";
import { Button } from "@/components/ui/Button";

export function SetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(setPasswordAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-brand-navy-900">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-brand-navy-900/20 px-3 py-2 text-sm focus:border-brand-green-600 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-brand-navy-900">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-brand-navy-900/20 px-3 py-2 text-sm focus:border-brand-green-600 focus:outline-none"
        />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving..." : "Set password & continue"}
      </Button>
    </form>
  );
}
