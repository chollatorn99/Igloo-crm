"use client";

import Link from "next/link";
import { useState } from "react";
import { reportPaymentBulk } from "./actions";

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "รอลูกค้าชำระ",
  awaiting_verification: "รอบัญชีตรวจสอบ",
  verified: "ตรวจสอบแล้ว",
  rejected: "สลิปไม่ผ่าน",
};
const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });

export type PayRow = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  category: string | null;
  net_premium: number | null;
  total_premium: number | null;
  net_commission_to_igloo: number | null;
  payment_status: string | null;
  payment_reference: string | null;
  payment_date: string | null;
  amount_received: number | null;
};

export function PaymentsTable({ rows, isManager }: { rows: PayRow[]; isManager: boolean }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [ref, setRef] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectable = rows.filter((r) => r.payment_status === "awaiting_payment");
  const toggle = (id: string) =>
    setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectedTotal = rows.filter((r) => sel.has(r.id)).reduce((s, r) => s + Number(r.total_premium ?? 0), 0);

  async function submitBulk() {
    setLoading(true); setError(null);
    try {
      const res = await reportPaymentBulk({
        ids: [...sel],
        reference: ref,
        date: date || null,
        amountReceived: amount === "" ? null : Number(amount),
      });
      if (res.error) setError(res.error);
      else { setSel(new Set()); setRef(""); setDate(""); setAmount(""); }
    } finally { setLoading(false); }
  }

  // Difference summary grouped by reference (a combined payment shares one ref).
  const byRef = new Map<string, { total: number; received: number | null }>();
  for (const r of rows) {
    if (!r.payment_reference || r.amount_received == null) continue;
    const g = byRef.get(r.payment_reference) ?? { total: 0, received: r.amount_received };
    g.total += Number(r.total_premium ?? 0);
    g.received = r.amount_received;
    byRef.set(r.payment_reference, g);
  }
  const refSummary = [...byRef.entries()].map(([ref, g]) => ({ ref, total: g.total, received: g.received ?? 0, diff: g.total - (g.received ?? 0) }));

  return (
    <div className="space-y-4">
      {sel.size > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="mb-2 text-sm font-semibold text-blue-900">แจ้งชำระรวม {sel.size} กรมธรรม์ · ยอดตามกรมธรรม์ {baht(selectedTotal)} บาท</p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs text-slate-600">เลขที่อ้างอิง *</label>
              <input value={ref} onChange={(e) => setRef(e.target.value)} className="w-40 rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">วันที่โอน</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">ยอดที่รับจริง (รวม)</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(selectedTotal)} className="w-36 rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
            </div>
            <button onClick={submitBulk} disabled={loading} className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
              {loading ? "กำลังบันทึก..." : "แจ้งชำระรวม"}
            </button>
            <button onClick={() => setSel(new Set())} className="text-xs text-blue-700 hover:underline">ล้าง</button>
          </div>
          {amount !== "" && (
            <p className="mt-2 text-xs text-slate-600">ส่วนต่าง (กรมธรรม์ − รับจริง): <span className="font-mono font-semibold">{baht(selectedTotal - Number(amount))}</span> บาท (อาจเป็นหัก ณ ที่จ่าย/ส่วนลด)</p>
          )}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3"></th>
              <th className="px-4 py-3">ลูกค้า</th>
              <th className="px-4 py-3">ประเภท</th>
              <th className="px-4 py-3">เบี้ยรวม</th>
              <th className="px-4 py-3">ยอดรับจริง</th>
              <th className="px-4 py-3">ส่วนต่าง</th>
              {isManager && <th className="px-4 py-3">ค่าคอมสุทธิ</th>}
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">เลขอ้างอิง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const diff = r.amount_received != null ? Number(r.total_premium ?? 0) - Number(r.amount_received) : null;
              return (
                <tr key={r.id} className={`hover:bg-slate-50 ${sel.has(r.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-3">
                    {r.payment_status === "awaiting_payment" && (
                      <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/policies/${r.id}`} className="font-medium text-slate-900 hover:underline">{r.customer_name ?? "-"}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.category ?? "-"}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{baht(Number(r.total_premium ?? 0))}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{r.amount_received != null ? baht(Number(r.amount_received)) : "-"}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{diff != null ? baht(diff) : "-"}</td>
                  {isManager && <td className="px-4 py-3 font-mono text-slate-600">{baht(Number(r.net_commission_to_igloo ?? 0))}</td>}
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.payment_status === "verified" ? "bg-emerald-100 text-emerald-700" : r.payment_status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                      {PAYMENT_STATUS_LABEL[r.payment_status as string] ?? "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.payment_reference ?? "-"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={isManager ? 9 : 8} className="px-4 py-10 text-center text-slate-400">ไม่มีรายการ</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {refSummary.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-slate-600">สรุปส่วนต่างตามเลขที่อ้างอิง</p>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400">
              <tr><th className="py-1">เลขอ้างอิง</th><th className="py-1">ยอดตามกรมธรรม์</th><th className="py-1">ยอดรับจริง</th><th className="py-1">ส่วนต่าง</th></tr>
            </thead>
            <tbody>
              {refSummary.map((s) => (
                <tr key={s.ref} className="border-t border-slate-100">
                  <td className="py-1.5 font-mono text-xs">{s.ref}</td>
                  <td className="py-1.5 font-mono">{baht(s.total)}</td>
                  <td className="py-1.5 font-mono">{baht(s.received)}</td>
                  <td className={`py-1.5 font-mono ${Math.abs(s.diff) > 0.5 ? "text-amber-600" : "text-slate-500"}`}>{baht(s.diff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-400">ส่วนต่าง = ยอดกรมธรรม์ − ยอดรับจริง (เช่น หัก ณ ที่จ่าย 1%/3% หรือส่วนลด)</p>
        </div>
      )}
    </div>
  );
}
