"use client";

import { useState } from "react";
import { exportToExcel } from "@/lib/exportExcel";
import { exportWinback, type WinbackFilters } from "./actions";

// Fetches the full filtered win-back set on demand (server action) then builds
// the .xlsx, so the paginated page never has to hold every row.
export function LazyExportButton({ filters }: { filters: WinbackFilters }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const result = await exportWinback(filters);
      if (result.error) {
        setError(result.error);
        return;
      }
      exportToExcel(result.rows ?? [], "win-back", result.watermark);
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
