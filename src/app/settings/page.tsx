import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createUser, deleteUser, updateCategoryDays, addCategory, bulkReassign } from "./actions";
import { ActionButton, ActionForm } from "./client-parts";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user!.id).single();

  if (myProfile?.role !== "manager") {
    redirect("/");
  }

  const [{ data: profiles }, { data: categories }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role, status").order("full_name"),
    supabase.from("policy_categories").select("id, name, renewal_reminder_days, active").order("name"),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <h1 className="text-lg font-semibold text-slate-900">Settings</h1>

      {/* Users */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">ผู้ใช้งาน</h2>
        <div className="mb-4 space-y-2">
          {profiles?.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
              <span>
                {p.full_name} <span className="ml-2 text-xs uppercase text-slate-400">{p.role}</span>
              </span>
              <ActionForm action={deleteUser.bind(null, p.id)} confirmMessage={`ลบผู้ใช้ "${p.full_name}"?`}>
                <ActionButton label="ลบ" className="text-rose-600 hover:underline" />
              </ActionForm>
            </div>
          ))}
        </div>

        <details className="rounded-lg border border-dashed border-slate-300 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-600">+ เพิ่มผู้ใช้ใหม่</summary>
          <ActionForm action={createUser} resetOnSuccess className="mt-3 space-y-2">
            <input name="full_name" placeholder="ชื่อ-นามสกุล" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="email" type="email" placeholder="อีเมล" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="password" type="password" placeholder="รหัสผ่านเริ่มต้น (อย่างน้อย 8 ตัว)" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <select name="role" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="sales">Sales</option>
              <option value="manager">Manager</option>
              <option value="accounting">Accounting</option>
            </select>
            <ActionButton label="เพิ่มผู้ใช้" className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800" />
          </ActionForm>
        </details>
      </section>

      {/* Bulk reassign */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">โอนย้ายลูกค้าทั้งหมด (เผื่อพนักงานลาออก)</h2>
        <ActionForm action={bulkReassign} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">จากคน</label>
            <select name="from_owner_id" required className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              {profiles?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">ไปให้คน</label>
            <select name="to_owner_id" required className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              {profiles?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
          <ActionButton label="โอนย้ายทั้งหมด" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800" />
        </ActionForm>
      </section>

      {/* Categories */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">ประเภทกรมธรรม์ &amp; วันแจ้งเตือนต่ออายุ</h2>
        <div className="mb-4 space-y-2">
          {categories?.map((c) => (
            <ActionForm
              key={c.id}
              action={updateCategoryDays.bind(null, c.id)}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
            >
              <span className="flex-1">{c.name}</span>
              <input
                type="number"
                name="renewal_reminder_days"
                defaultValue={c.renewal_reminder_days}
                className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
              <span className="text-xs text-slate-400">วัน</span>
              <ActionButton label="บันทึก" className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200" />
            </ActionForm>
          ))}
        </div>

        <details className="rounded-lg border border-dashed border-slate-300 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-600">+ เพิ่มประเภทกรมธรรม์ใหม่</summary>
          <ActionForm action={addCategory} resetOnSuccess className="mt-3 flex items-end gap-2">
            <input name="name" placeholder="ชื่อประเภท" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input
              type="number"
              name="renewal_reminder_days"
              defaultValue={120}
              className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <ActionButton label="เพิ่ม" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800" />
          </ActionForm>
        </details>
      </section>
    </div>
  );
}
