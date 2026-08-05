"use client";

import { useActionState, useEffect } from "react";
import { subscribeAction } from "@/app/(marketing)/subscribe/actions";
import { Button } from "@/components/ui/Button";
import { trackClientEvent } from "@/lib/analytics";
import type { LeadSource } from "@/lib/leads";

export function LeadCaptureForm({ source }: { source: LeadSource }) {
  const [state, formAction, pending] = useActionState(subscribeAction, undefined);

  useEffect(() => {
    if (state?.ok) trackClientEvent("Lead captured", { source });
  }, [state, source]);

  return (
    <form action={formAction} className="mt-6 max-w-md">
      <input type="hidden" name="source" value={source} />
      <label htmlFor={`lead-email-${source}`} className="sr-only">
        Email
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={`lead-email-${source}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full rounded-lg border border-brand-navy-900/20 px-3 py-2 text-sm focus:border-brand-green-600 focus:outline-none"
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? "Sending..." : "Send me the checklist"}
        </Button>
      </div>
      {state?.ok ? <p className="mt-3 text-sm text-brand-green-700">{state.message}</p> : null}
      {state && !state.ok ? <p className="mt-3 text-sm text-red-600">{state.error}</p> : null}
      <p className="mt-3 text-xs text-brand-navy-900/50">
        Double opt-in — you&apos;ll get a confirmation link first. No spam, unsubscribe any time.
      </p>
    </form>
  );
}
