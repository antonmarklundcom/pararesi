import Link from "next/link";
import type { ReactNode } from "react";

export interface Column<Row> {
  header: string;
  render: (row: Row) => ReactNode;
}

export function DataTable<Row extends { id: number }>({
  columns,
  rows,
  editHref,
  emptyMessage = "Nothing here yet.",
}: {
  columns: Column<Row>[];
  rows: Row[];
  editHref: (row: Row) => string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-brand-navy-900/60">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-brand-navy-900/10 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-brand-navy-900/10 text-xs uppercase tracking-wide text-brand-navy-900/50">
          <tr>
            {columns.map((col) => (
              <th key={col.header} className="px-4 py-3 font-medium">
                {col.header}
              </th>
            ))}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-brand-navy-900/5 last:border-0">
              {columns.map((col) => (
                <td key={col.header} className="px-4 py-3 text-brand-navy-900">
                  {col.render(row)}
                </td>
              ))}
              <td className="px-4 py-3 text-right">
                <Link href={editHref(row)} className="text-brand-green-600 hover:text-brand-green-700">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
