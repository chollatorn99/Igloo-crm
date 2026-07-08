"use client";

import { useState } from "react";
import { checkDuplicatePhone, createCustomer } from "../actions";

type DuplicateMatch = { customer_id: string; customer_name: string; owner_name: string };

export function NewCustomerForm({
  salesOptions,
  isManager,
}: {
  salesOptions: { id: string; full_name: string }[];
  isManager: boolean;
}) {
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handlePhoneBlur(e: React.FocusEvent<HTMLInputElement>) {
    const phone = e.target.value.trim();
    if (!phone) {
      setDuplicates([]);
      return;
    }
    setChecking(true);
    const matches = await checkDuplicatePhone(phone);
    setChecking(false);
    setDuplicates(matches);
  }

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createCustomer(formData);
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
    <form action={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6">
      <label className="mb-1 block text-xs font-medium text-slate-600">ชื่อลูกค้า / องค์กร</label>
      <input
        name="name"
        required
        className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
      />

      <label className="mb-1 block text-xs font-medium text-slate-600">ประเภท</label>
      <select
        name="customer_type"
        className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
      >
        <option value="individual">บุคคล</option>
        <option value="organization">องค์กร / บริษัท / โรงเรียน</option>
      </select>

      <label className="mb-1 block text-xs font-medium text-slate-600">เบอร์โทร</label>
      <input
        name="phone"
        onBlur={handlePhoneBlur}
        className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
      />
      {checking && <p className="mb-3 text-xs text-slate-400">กำลังเช็คเบอร์ซ้ำ...</p>}
      {duplicates.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
          ⚠ เบอร์นี้มีอยู่แล้ว: <strong>{duplicates[0].customer_name}</strong> (เจ้าของ:{" "}
          {duplicates[0].owner_name}) — ตรวจสอบก่อนสร้างซ้ำ
        </div>
      )}
      {!duplicates.length && !checking && <div className="mb-4" />}

      {isManager && (
        <>
          <label className="mb-1 block text-xs font-medium text-slate-600">เจ้าของลูกค้า</label>
          <select
            name="owner_id"
            className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          >
            {salesOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </>
      )}

      {error && <p className="mb-4 text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {submitting ? "กำลังบันทึก..." : "บันทึกลูกค้า"}
      </button>
    </form>
  );
}
