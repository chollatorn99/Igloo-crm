"use client";

import { exportToExcel } from "@/lib/exportExcel";

export function ClaimsExport({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <button
      onClick={() => exportToExcel(rows, `claims-report-${new Date().toISOString().slice(0, 10)}`)}
      disabled={rows.length === 0}
      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
    >
      Export Excel
    </button>
  );
}
