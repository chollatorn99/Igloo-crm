"use client";

import { useState } from "react";
import { exportToExcel } from "@/lib/exportExcel";
import { exportCustomers } from "./actions";

// Fetches the full filtered customer set on demand (server action) then
// builds the .xlsx — so the paginated page stays light but the export is
// still complete.
export function LazyExportButton({ q }: { q?: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const rows = await exportCustomers(q);
      exportToExcel(rows, "customers");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
    >
      {loading ? "กำลังเตรียม..." : "Export Excel"}
    </button>
  );
}
