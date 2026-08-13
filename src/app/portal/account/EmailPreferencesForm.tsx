"use client";

import { useActionState, useState } from "react";
import { updateEmailPreferencesAction } from "./actions";
import { Button } from "@/components/ui/Button";

/**
 * The one member-facing email preference. The checkbox is controlled so the box
 * keeps showing what the member just chose while the action is in flight,
 * rather than snapping back to the server value and then forward again.
 */
export function EmailPreferencesForm({ updateEmailsEnabled }: { updateEmailsEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(updateEmailPreferencesAction, undefined);
  const [checked, setChecked] = useState(updateEmailsEnabled);

  return (
    <form action={formAction} className="space-y-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="updateEmailsEnabled"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-brand-navy-900/30 text-brand-green-600 focus:ring-brand-green-600"
        />
        <span className="text-sm text-brand-navy-900">
          Email me when a new update is published
          <span className="mt-1 block text-brand-navy-900/60">
            Law and fee changes as they happen. Turning this off doesn&apos;t affect your access
            to the updates feed in the portal, or emails about your account and payments.
          </span>
        </span>
      </label>
      {state?.success ? <p className="text-sm text-brand-green-700">Preferences saved.</p> : null}
      <Button type="submit" disabled={pending} variant="secondary">
        {pending ? "Saving..." : "Save preferences"}
      </Button>
    </form>
  );
}
