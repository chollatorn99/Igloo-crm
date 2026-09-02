"use client";

import { useState } from "react";
import { updateCustomerInfo } from "./actions";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  line_id: string | null;
  customer_type: string;
};

export function CustomerEditForm({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    const result = await updateCustomerInfo(customer.id, formData);
    if (result?.error) setError(result.error);
    else {
      setSaved(true);
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-3 border-t border-slate-100 pt-3">
        <button
          onClick={() => { setOpen(true); setSaved(false); }}
          className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          ✎ แก้ไขข้อมูลลูกค้า
        </button>
        {saved && <span className="ml-2 text-xs text-emerald-600">บันทึกแล้ว</span>}
      </div>
    );
  }

  const field = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";
  const label = "mb-1 block text-xs font-medium text-slate-600";

  return (
    <form action={handleSubmit} className="mt-3 space-y-3 border-t border-slate-100 pt-3">
      <div>
        <label className={label}>ชื่อลูกค้า *</label>
        <input name="name" required defaultValue={customer.name} className={field} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>เบอร์โทร</label>
          <input name="phone" defaultValue={customer.phone ?? ""} className={field} />
        </div>
        <div>
          <label className={label}>LINE ID</label>
          <input name="line_id" defaultValue={customer.line_id ?? ""} className={field} />
        </div>
      </div>
      <div>
        <label className={label}>อีเมล</label>
        <input name="email" type="email" defaultValue={customer.email ?? ""} className={field} />
      </div>
      <div>
        <label className={label}>ที่อยู่</label>
        <textarea name="address" rows={2} defaultValue={customer.address ?? ""} className={field} />
      </div>
      <div>
        <label className={label}>ประเภทลูกค้า</label>
        <select name="customer_type" defaultValue={customer.customer_type} className={field}>
          <option value="individual">บุคคล</option>
          <option value="organization">องค์กร</option>
        </select>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          บันทึก
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
