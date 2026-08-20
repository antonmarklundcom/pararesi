import type { ReactNode } from "react";

/**
 * One number on the admin dashboard. `tone` is for the numbers that mean
 * someone has to do something — a failed webhook, a past_due card — so the
 * dashboard can be scanned for problems rather than read top to bottom.
 */
export function StatTile({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "neutral" | "warn" | "bad";
}) {
  const valueTone =
    tone === "bad" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-brand-navy-950";

  return (
    <div className="rounded-xl border border-brand-navy-900/10 bg-white px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-brand-navy-900/50">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueTone}`}>{value}</p>
      {detail ? <p className="mt-1 text-sm text-brand-navy-900/60">{detail}</p> : null}
    </div>
  );
}
