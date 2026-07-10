"use client";

import { useState } from "react";
import { exportToExcel } from "@/lib/exportExcel";
import { exportCustomers } from "./actions";

// Fetches the full filtered customer set on demand (server action) then
// builds the .xlsx — so the paginated page stays light but the export is
// still complete. The action gates by role, logs, and returns a watermark.
export function LazyExportButton({ q }: { q?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const result = await exportCustomers(q);
      if (result.error) {
        setError(result.error);
        return;
      }
      exportToExcel(result.rows ?? [], "customers", result.watermark);
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
