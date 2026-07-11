"use client";

import { useState } from "react";
import { reportPaymentTransfer } from "@/app/(app)/policies/actions";

const METHODS = [
  { value: "transfer_igloo", label: "โอนเข้าอิกลู" },
  { value: "transfer_insurer", label: "โอนให้บริษัทประกันโดยตรง" },
  { value: "credit_card", label: "บัตรเครดิต" },
  { value: "installment_igloo", label: "ผ่อนกับอิกลู" },
];

export function PaymentReportForm({ policyId }: { policyId: string }) {
  const [method, setMethod] = useState("transfer_igloo");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const showInstallmentCount = method === "credit_card" || method === "installment_igloo";
  const showInstallmentAmount = method === "installment_igloo";

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await reportPaymentTransfer(policyId, formData);
    setLoading(false);
    if (result?.error) setError(result.error);
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs text-slate-500">วิธีรับชำระ</label>
        <select
          name="payment_method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          {METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {showInstallmentCount && (
        <div>
          <label className="mb-1 block text-xs text-slate-500">จำนวนงวด</label>
          <input
            type="number"
            name="installment_count"
            min={1}
            defaultValue={1}
            className="w-24 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
      )}

      {showInstallmentAmount && (
        <div>
          <label className="mb-1 block text-xs text-slate-500">ยอดต่องวด</label>
          <input
            type="number"
            step="0.01"
            name="installment_amount"
            className="w-28 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs text-slate-500">เลขอ้างอิง / สลิป</label>
        <input name="payment_reference" required className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">วันที่ชำระ</label>
        <input type="date" name="payment_date" required className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "กำลังบันทึก..." : "แจ้งชำระแล้ว"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
