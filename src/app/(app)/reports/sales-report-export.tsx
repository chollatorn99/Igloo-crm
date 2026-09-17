"use client";

import { useState } from "react";
import { exportToExcel } from "@/lib/exportExcel";
import { exportSalesReport } from "./actions";

export function SalesReportExport({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    setDone(null);
    try {
      const result = await exportSalesReport(from, to);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (!result.rows?.length) {
        setError("ไม่มีข้อมูลในช่วงวันที่เลือก");
        return;
      }
      exportToExcel(result.rows, `sales-report-${from}_${to}`, result.watermark);
      setDone(result.rows.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  const field = "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

  return (
    <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">ตั้งแต่วัน (วันแจ้งงาน)</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">ถึงวัน</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
        </div>
        <button
          onClick={handleExport}
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "กำลังเตรียม..." : "Export Excel"}
        </button>
      </div>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      {done !== null && <p className="mt-3 text-xs text-emerald-600">ดาวน์โหลดแล้ว {done.toLocaleString()} รายการ</p>}
    </div>
  );
}
