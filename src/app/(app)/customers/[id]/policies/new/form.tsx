"use client";

import { useState } from "react";
import { createPolicy } from "@/app/(app)/policies/actions";

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
  // Live running total so staff can check เบี้ยรวม against the paperwork before saving.
  const [net, setNet] = useState(0);
  const [stamp, setStamp] = useState(0);
  const [vat, setVat] = useState(0);
  const totalPremium = net + stamp + vat;
  const [withPrb, setWithPrb] = useState(false);
  const [installment, setInstallment] = useState(false);

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

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">สาขา / ที่ตั้ง (ถ้ามีหลายสาขา)</label>
        <input name="branch_name" placeholder="เช่น ปตท. สาขาลาดพร้าว — ใส่เหมือนกันทุกใบของสาขานี้" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <p className="mt-1 text-[11px] text-slate-400">งานพาณิชย์หลายกรมธรรม์/สาขา (IAR + PL + พ.ร.บ. + ประกันเงิน) ใส่ชื่อสาขาเดียวกันทุกใบ ระบบจะนับเป็น 1 ยูนิตต่อสาขา</p>
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
          <input type="number" step="0.01" name="net_premium" onChange={(e) => setNet(Number(e.target.value) || 0)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">อากรสแตมป์</label>
          <input type="number" step="0.01" name="stamp_duty" defaultValue={0} onChange={(e) => setStamp(Number(e.target.value) || 0)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">VAT</label>
          <input type="number" step="0.01" name="vat" defaultValue={0} onChange={(e) => setVat(Number(e.target.value) || 0)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md bg-slate-100 px-3 py-2 text-sm">
        <span className="text-slate-600">เบี้ยรวม (เบี้ย + อากร + VAT)</span>
        <span className="font-mono font-semibold text-slate-900">
          {totalPremium.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
        </span>
      </div>

      {/* Issue the compulsory พ.ร.บ. together with this voluntary motor policy */}
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="with_prb" checked={withPrb} onChange={(e) => setWithPrb(e.target.checked)} className="h-4 w-4" />
          ออก พ.ร.บ. รถ ด้วย (สร้างกรมธรรม์ พรบ.รถ เพิ่มอีก 1 ใบ)
        </label>
        {withPrb && (
          <div className="mt-2 w-48">
            <label className="mb-1 block text-xs font-medium text-slate-600">เบี้ย พ.ร.บ. (สุทธิ)</label>
            <input type="number" step="0.01" name="prb_premium" defaultValue={600} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">% ค่าคอมจากบริษัทประกัน</label>
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

      {/* Installment plan — customer pays the insurer in monthly instalments. */}
      <div className="rounded-md border border-sky-200 bg-sky-50 p-3">
        <label className="flex items-center gap-2 text-sm text-sky-900">
          <input type="checkbox" name="is_installment" checked={installment} onChange={(e) => setInstallment(e.target.checked)} className="h-4 w-4" />
          ผ่อนชำระกับบริษัท (แบ่งจ่ายรายเดือน)
        </label>
        {installment && (
          <div className="mt-2 flex flex-wrap gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">จำนวนงวด (เดือน)</label>
              <input type="number" name="installment_months" min={1} max={60} className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">เดือนละ (บาท)</label>
              <input type="number" step="0.01" name="installment_amount" className="w-36 rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">ผ่อนกับ</label>
              <select name="installment_with" defaultValue="" className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">— เลือก —</option>
                <option value="igloo">อิกลู โบรคเกอร์</option>
                <option value="insurer">บริษัทประกัน</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">ดอกเบี้ย (%)</label>
              <input type="number" step="0.01" name="installment_interest_rate" defaultValue={0} className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <p className="w-full text-[11px] text-slate-400">ดอกเบี้ย 0 = ผ่อน 0% · ระบบจะสร้างตารางงวดให้อัตโนมัติ แล้วไปติ๊กจ่ายได้ที่หน้า &quot;ติดตามการผ่อนชำระ&quot;</p>
          </div>
        )}
      </div>

      {/* Group / affiliated-company work — kept out of normal sales & commission totals. */}
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
        <label className="flex items-center gap-2 text-sm text-amber-900">
          <input type="checkbox" name="is_intercompany" className="h-4 w-4" />
          งานบริษัทในเครือ (ไม่นับรวมยอดขาย/ค่าคอม — แยกเป็นก้อนในแดชบอร์ด)
        </label>
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
