"use client";

import { exportToExcel } from "@/lib/exportExcel";

export function ExportButton({
  rows,
  filename = "export",
}: {
  rows: Record<string, unknown>[];
  filename?: string;
}) {
  return (
    <button
      onClick={() => exportToExcel(rows, filename)}
      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
    >
      Export Excel
    </button>
  );
}
