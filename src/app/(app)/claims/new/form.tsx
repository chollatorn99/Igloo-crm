"use client";

import { useState } from "react";
import { createClaim } from "../actions";

export function NewClaimForm({
  customerId,
  customerName,
  policies,
}: {
  customerId: string;
  customerName: string;
  policies: { id: string; label: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    const result = await createClaim(formData);
    if (result?.error) { setSubmitting(false); setError(result.error); }
  }

  const field = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";
  const label = "mb-1 block text-xs font-medium text-slate-600";

  return (
    <form action={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <input type="hidden" name="customer_id" value={customerId} />
      <p className="text-sm text-slate-700">ลูกค้า: <span className="font-semibold">{customerName}</span></p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>เลขที่เคลม</label>
          <input name="claim_number" className={field} />
        </div>
        <div>
          <label className={label}>กรมธรรม์ที่เกี่ยวข้อง</label>
          <select name="policy_id" defaultValue="" className={field}>
            <option value="">— ไม่ระบุ —</option>
            {policies.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={label}>ผู้ทำเคลม (ชื่อสมาชิกในกลุ่ม — กรณีประกันกลุ่ม)</label>
        <input name="claimant_name" placeholder="เว้นว่างได้ถ้าเป็นลูกค้ารายบุคคล" className={field} />
      </div>

      <div>
        <label className={label}>รายละเอียดเคลม (รถ/ความเสียหาย/เหตุการณ์)</label>
        <textarea name="detail" rows={3} className={field} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={label}>วันที่ลูกค้าแจ้งเคลม</label>
          <input type="date" name="reported_date" defaultValue={today} className={field} />
        </div>
        <div>
          <label className={label}>ยอดเคลม (ประมาณ)</label>
          <input type="number" step="0.01" name="claim_amount" className={field} />
        </div>
        <div>
          <label className={label}>ติดตามครั้งถัดไป</label>
          <input type="date" name="next_followup_date" className={field} />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
        {submitting ? "กำลังบันทึก..." : "เปิดเคลม"}
      </button>
    </form>
  );
}
