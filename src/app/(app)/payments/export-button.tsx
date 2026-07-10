"use client";

import { useState } from "react";
import { exportToExcel } from "@/lib/exportExcel";
import { authorizeAndLogExport } from "@/app/(app)/export-actions";

// Export button for pages that already have the full row set server-rendered
// (payments queue, history). Routes through authorizeAndLogExport first so
// the export is role-gated (sales refused), logged, and watermarked.
export function ExportButton({
  rows,
  filename = "export",
  exportType,
  filterNote,
}: {
  rows: Record<string, unknown>[];
  filename?: string;
  exportType: string;
  filterNote?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const auth = await authorizeAndLogExport(exportType, rows.length, filterNote);
      if (auth.error) {
        setError(auth.error);
        return;
      }
      exportToExcel(rows, filename, auth.watermark);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
      >
        {loading ? "กำลังเตรียม..." : "Export Excel"}
      </button>
      {error && <p className="mt-1 max-w-xs text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
