"use client";

import Link from "next/link";
import { useState } from "react";

type Row = {
  id: string;
  name: string;
  phone: string | null;
  customer_type: string;
  call_count: number;
  last_call_result: string | null;
  owner: { full_name: string } | null;
};

export function EnvelopeSelectTable({ customers, emptyText }: { customers: Row[]; emptyText: string }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const allOnPage = customers.length > 0 && customers.every((c) => sel.has(c.id));
  const toggleAll = () =>
    setSel((prev) => {
      const n = new Set(prev);
      if (allOnPage) customers.forEach((c) => n.delete(c.id));
      else customers.forEach((c) => n.add(c.id));
      return n;
    });
  const printSelected = () => {
    if (!sel.size) return;
    window.open(`/customers/envelopes?ids=${[...sel].join(",")}`, "_blank");
  };

  return (
    <>
      <div className="mb-2 flex items-center gap-3">
        <button
          onClick={printSelected}
          disabled={sel.size === 0}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          🖨️ พิมพ์ซองที่เลือก ({sel.size})
        </button>
        {sel.size > 0 && (
          <button onClick={() => setSel(new Set())} className="text-xs text-blue-600 hover:underline">
            ล้างที่เลือก
          </button>
        )}
        <span className="text-xs text-slate-400">ติ๊กเลือกลูกค้าที่ต้องการพิมพ์จ่าหน้าซอง</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">
                <input type="checkbox" checked={allOnPage} onChange={toggleAll} className="h-4 w-4" />
              </th>
              <th className="px-4 py-3">ชื่อ</th>
              <th className="px-4 py-3">เบอร์โทร</th>
              <th className="px-4 py-3">ประเภท</th>
              <th className="px-4 py-3">เจ้าของ</th>
              <th className="px-4 py-3">จำนวนครั้งที่โทร</th>
              <th className="px-4 py-3">ผลล่าสุด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((c) => (
              <tr key={c.id} className={`hover:bg-slate-50 ${sel.has(c.id) ? "bg-blue-50" : ""}`}>
                <td className="px-3 py-3">
                  <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4" />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/customers/${c.id}`} className="font-medium text-slate-900 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.phone ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{c.customer_type === "organization" ? "องค์กร" : "บุคคล"}</td>
                <td className="px-4 py-3 text-slate-600">{c.owner?.full_name ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{c.call_count}</td>
                <td className="px-4 py-3 text-slate-600">{c.last_call_result ?? "-"}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">{emptyText}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
