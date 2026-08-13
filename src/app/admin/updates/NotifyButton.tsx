"use client";

export function NotifyButton({
  action,
  recipientLabel,
}: {
  action: () => void | Promise<void>;
  recipientLabel: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        // Sending is one-way and one-shot — worth a deliberate second click.
        if (!confirm(`Email ${recipientLabel} about this update? This can only be done once.`)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-full border border-brand-navy-900/15 px-4 py-2 text-sm font-medium text-brand-navy-900 hover:bg-brand-navy-900/5"
      >
        Notify members
      </button>
    </form>
  );
}
