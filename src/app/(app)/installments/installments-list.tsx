"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setInstallmentPaid } from "./actions";

export type InstallmentRow = {
  id: string;
  policy_id: string;
  installment_no: number;
  due_date: string | null;
  amount: number | null;
  paid: boolean;
  paid_date: string | null;
  note: string | null;
};

const baht = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });

export function InstallmentCard({
  policyId,
  customerName,
  categoryName,
  withWhom,
  interestRate,
  planMonths,
  planAmount,
  paidCount,
  totalCount,
  paidAmount,
  remaining,
  overdue,
  done,
  rows,
}: {
  policyId: string;
  customerName: string;
  categoryName: string;
  withWhom: string | null;
  interestRate: number;
  planMonths: number | null;
  planAmount: number | null;
  paidCount: number;
  totalCount: number;
  paidAmount: number;
  remaining: number;
  overdue: boolean;
  done: boolean;
  rows: InstallmentRow[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

  const pct = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

  function toggle(r: InstallmentRow) {
    setBusyId(r.id);
    startTransition(async () => {
      await setInstallmentPaid(r.id, !r.paid, r.paid ? null : today);
      setBusyId(null);
    });
  }

  return (
    <div className={`rounded-xl border bg-white ${overdue ? "border-rose-200" : done ? "border-emerald-200" : "border-slate-200"}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">
            {customerName}
            <span className="ml-2 text-xs font-normal text-slate-400">{categoryName}</span>
            {withWhom && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">ผ่อนกับ{withWhom}</span>}
            <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${interestRate > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
              {interestRate > 0 ? `ดอกเบี้ย ${interestRate}%` : "0%"}
            </span>
          </p>
          <p className="text-xs text-slate-500">
            แผน {planMonths ?? totalCount} งวด{planAmount ? ` · งวดละ ${baht(Number(planAmount))}` : ""} · จ่ายแล้ว {paidCount}/{totalCount} ({baht(paidAmount)}) · เหลือ{" "}
            <span className={remaining > 0 ? "font-semibold text-slate-700" : "text-emerald-600"}>{baht(remaining)}</span>
            {overdue && <span className="ml-1 font-semibold text-rose-600">· เลยกำหนด</span>}
            {done && <span className="ml-1 font-semibold text-emerald-600">· ครบแล้ว</span>}
          </p>
          <div className="mt-1.5 h-1.5 w-56 max-w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full ${done ? "bg-emerald-500" : overdue ? "bg-rose-400" : "bg-sky-500"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className="shrink-0 text-xs text-slate-400">{open ? "ซ่อน ▲" : "ดูงวด ▼"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-2">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400">
              <tr>
                <th className="py-1">งวด</th>
                <th className="py-1">กำหนดชำระ</th>
                <th className="py-1">จำนวน</th>
                <th className="py-1">สถานะ</th>
                <th className="py-1">วันที่จ่าย</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isOverdue = !r.paid && r.due_date && r.due_date < today;
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-1.5">{r.installment_no}</td>
                    <td className={`py-1.5 ${isOverdue ? "font-medium text-rose-600" : "text-slate-600"}`}>{r.due_date ?? "-"}</td>
                    <td className="py-1.5 font-mono text-slate-600">{r.amount != null ? baht(Number(r.amount)) : "-"}</td>
                    <td className="py-1.5">
                      {r.paid ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">จ่ายแล้ว</span>
                      ) : (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isOverdue ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                          {isOverdue ? "เลยกำหนด" : "ค้างชำระ"}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-xs text-slate-500">
                      {r.paid_date ?? "-"}
                      {r.paid && r.paid_date && r.due_date && (
                        r.paid_date > r.due_date
                          ? <span className="ml-1 text-amber-600">· จ่ายช้า</span>
                          : <span className="ml-1 text-emerald-600">· ตรงเวลา</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        onClick={() => toggle(r)}
                        disabled={pending && busyId === r.id}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                          r.paid ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {pending && busyId === r.id ? "..." : r.paid ? "ยกเลิก" : "ติ๊กจ่ายแล้ว"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Link href={`/policies/${policyId}`} className="mt-2 inline-block text-xs text-blue-600 hover:underline">
            ดูกรมธรรม์ →
          </Link>
        </div>
      )}
    </div>
  );
}
