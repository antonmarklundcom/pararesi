"use client";

export function DeleteButton({ action, label = "Delete" }: { action: () => void | Promise<void>; label?: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Delete this? This cannot be undone.")) e.preventDefault();
      }}
    >
      <button type="submit" className="text-sm text-red-600 hover:text-red-700">
        {label}
      </button>
    </form>
  );
}
