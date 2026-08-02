"use client";

import { useState } from "react";
import { exportUserJsonAction } from "./actions";

export function ExportUserJsonButton({ userId, email }: { userId: number; email: string }) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      const json = await exportUserJsonAction(userId);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${email}-data-export.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-sm text-brand-green-600 hover:text-brand-green-700 disabled:opacity-50"
    >
      {pending ? "Preparing…" : "Export data as JSON"}
    </button>
  );
}
