"use client";

import { useActionState } from "react";
import { changePasswordAction } from "./actions";
import { Button } from "@/components/ui/Button";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="currentPassword" className="block text-sm font-medium text-brand-navy-900">
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-brand-navy-900/20 px-3 py-2 text-sm focus:border-brand-green-600 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-brand-navy-900">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-brand-navy-900/20 px-3 py-2 text-sm focus:border-brand-green-600 focus:outline-none"
        />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state?.success ? <p className="text-sm text-brand-green-700">Password updated.</p> : null}
      <Button type="submit" disabled={pending} variant="secondary">
        {pending ? "Saving..." : "Update password"}
      </Button>
    </form>
  );
}
