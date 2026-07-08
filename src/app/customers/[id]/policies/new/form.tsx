"use client";

import { useState } from "react";
import { createPolicy } from "@/app/policies/actions";

export function NewPolicyForm({
  customerId,
  categories,
  agents,
}: {
  customerId: string;
  categories: { id: string; name: string }[];
  agents: { id: string; name: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createPolicy(customerId, formData);
      if (result?.error) {
        setSubmitting(false);
        setError(result.error);
      }
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">ประเภทกรมธรรม์ *</label>
        <select name="category_id" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">บริษัทประกัน</label>
        <input name="insurance_company" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">รายละเอียดกรมธรรม์</label>
        <input name="policy_detail" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">วันที่เริ่มคุ้มครอง</label>
          <input type="date" name="coverage_start_date" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">วันหมดอายุ</label>
          <input type="date" name="coverage_end_date" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">เบี้ยประกัน</label>
          <input type="number" step="0.01" name="net_premium" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">อากรสแตมป์</label>
          <input type="number" step="0.01" name="stamp_duty" defaultValue={0} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">VAT</label>
          <input type="number" step="0.01" name="vat" defaultValue={0} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">% ค่าคอมบริษัท</label>
          <input type="number" step="0.01" name="company_commission_rate" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">ส่วนลดลูกค้า (บาท)</label>
          <input type="number" step="0.01" name="customer_discount_amount" defaultValue={0} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Agent (freelance)</label>
          <select name="agent_id" defaultValue="" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">ไม่มี</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">% ค่าคอม Agent</label>
          <input type="number" step="0.01" name="agent_commission_rate" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">หมายเหตุ</label>
        <textarea name="notes" rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {submitting ? "กำลังบันทึก..." : "บันทึกกรมธรรม์ (Pending)"}
      </button>
    </form>
  );
}
