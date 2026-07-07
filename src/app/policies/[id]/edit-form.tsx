"use client";

import { useState } from "react";
import { updatePolicyDetails } from "@/app/policies/actions";

type Policy = {
  id: string;
  category: { id: string } | null;
  insurance_company: string | null;
  policy_detail: string | null;
  coverage_start_date: string | null;
  coverage_end_date: string | null;
  net_premium: number | null;
  stamp_duty: number | null;
  vat: number | null;
  total_collectible: number | null;
  company_commission_rate: number | null;
  agent: { id: string } | null;
  agent_commission_rate: number | null;
  customer_discount_amount: number | null;
  notes: string | null;
};

export function PolicyEditForm({
  policy,
  categories,
  agents,
}: {
  policy: Policy;
  categories: { id: string; name: string }[];
  agents: { id: string; name: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    try {
      await updatePolicyDetails(policy.id, formData);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-700">รายละเอียดกรมธรรม์</h2>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">ประเภทกรมธรรม์</label>
        <select
          name="category_id"
          defaultValue={policy.category?.id ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">บริษัทประกัน</label>
        <input
          name="insurance_company"
          defaultValue={policy.insurance_company ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">รายละเอียดกรมธรรม์</label>
        <input
          name="policy_detail"
          defaultValue={policy.policy_detail ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">วันที่เริ่มคุ้มครอง</label>
          <input
            type="date"
            name="coverage_start_date"
            defaultValue={policy.coverage_start_date ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">วันหมดอายุ</label>
          <input
            type="date"
            name="coverage_end_date"
            defaultValue={policy.coverage_end_date ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">เบี้ยประกัน</label>
          <input
            type="number"
            step="0.01"
            name="net_premium"
            defaultValue={policy.net_premium ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">อากรสแตมป์</label>
          <input
            type="number"
            step="0.01"
            name="stamp_duty"
            defaultValue={policy.stamp_duty ?? 0}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">VAT</label>
          <input
            type="number"
            step="0.01"
            name="vat"
            defaultValue={policy.vat ?? 0}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">รวมยอดชำระทั้งสิ้น (ถ้าต่างจากเบี้ยรวม)</label>
        <input
          type="number"
          step="0.01"
          name="total_collectible"
          defaultValue={policy.total_collectible ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">% ค่าคอมบริษัท</label>
          <input
            type="number"
            step="0.01"
            name="company_commission_rate"
            defaultValue={policy.company_commission_rate ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">ส่วนลดลูกค้า (บาท)</label>
          <input
            type="number"
            step="0.01"
            name="customer_discount_amount"
            defaultValue={policy.customer_discount_amount ?? 0}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Agent (freelance)</label>
          <select
            name="agent_id"
            defaultValue={policy.agent?.id ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
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
          <input
            type="number"
            step="0.01"
            name="agent_commission_rate"
            defaultValue={policy.agent_commission_rate ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">หมายเหตุ</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={policy.notes ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {saved && !error && <p className="text-xs text-emerald-600">บันทึกแล้ว</p>}

      <button
        type="submit"
        className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        บันทึกการแก้ไข
      </button>
    </form>
  );
}
