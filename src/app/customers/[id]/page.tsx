import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addFollowUpNote, reassignOwner } from "./actions";
import { ActionForm } from "@/components/ActionForm";

const DEAL_STATUS_LABEL: Record<string, string> = {
  pending: "กำลังติดตาม",
  win: "Win",
  lost: "Lost",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  const isManager = myProfile?.role === "manager";

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, phone, customer_type, call_count, last_call_result, owner_id, owner:profiles(full_name)")
    .eq("id", id)
    .single();

  if (!customer) notFound();

  const { data: salesOptions } = isManager
    ? await supabase.from("profiles").select("id, full_name").in("role", ["sales", "manager"]).order("full_name")
    : { data: null };

  const { data: notes } = await supabase
    .from("follow_up_notes")
    .select("id, note_text, created_at, author:profiles(full_name)")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  const { data: policies } = await supabase
    .from("policies")
    .select("id, deal_status, insurance_company, net_premium, category:policy_categories(name)")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  const addNote = addFollowUpNote.bind(null, id);
  const reassign = reassignOwner.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-slate-900">{customer.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {customer.customer_type === "organization" ? "องค์กร" : "บุคคล"} ·{" "}
          {customer.phone ?? "ไม่มีเบอร์โทร"} · เจ้าของ:{" "}
          {(customer.owner as unknown as { full_name: string } | null)?.full_name ?? "-"}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          โทรไปแล้ว {customer.call_count} ครั้ง
          {customer.last_call_result ? ` · ล่าสุด: ${customer.last_call_result}` : ""}
        </p>

        {isManager && salesOptions && (
          <ActionForm action={reassign} className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <label className="text-xs text-slate-500">โอนย้ายเจ้าของ:</label>
            <select
              name="owner_id"
              defaultValue={customer.owner_id}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            >
              {salesOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
            <button className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">
              โอนย้าย
            </button>
          </ActionForm>
        )}
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">กรมธรรม์</h2>
          <Link
            href={`/customers/${id}/policies/new`}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            + เพิ่มกรมธรรม์
          </Link>
        </div>
        <div className="space-y-2">
          {policies?.map((p) => (
            <Link
              key={p.id}
              href={`/policies/${p.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <span>
                {(p.category as unknown as { name: string } | null)?.name} ·{" "}
                {p.insurance_company ?? "ยังไม่ระบุบริษัทประกัน"}
                {p.net_premium != null && ` · ${Number(p.net_premium).toLocaleString()} บาท`}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  p.deal_status === "win"
                    ? "bg-emerald-100 text-emerald-700"
                    : p.deal_status === "lost"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-amber-100 text-amber-700"
                }`}
              >
                {DEAL_STATUS_LABEL[p.deal_status]}
              </span>
            </Link>
          ))}
          {policies?.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีกรมธรรม์</p>}
        </div>
      </div>

      <ActionForm action={addNote} className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-1 block text-xs font-medium text-slate-600">บันทึกผลการโทร / ติดตาม</label>
        <textarea
          name="note_text"
          required
          rows={3}
          className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          บันทึก
        </button>
      </ActionForm>

      <h2 className="mb-3 text-sm font-semibold text-slate-700">ประวัติการติดตาม</h2>
      <div className="space-y-3">
        {notes?.map((n) => (
          <div key={n.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <p className="text-slate-800">{n.note_text}</p>
            <p className="mt-1 text-xs text-slate-400">
              {(n.author as unknown as { full_name: string } | null)?.full_name ?? "-"} ·{" "}
              {new Date(n.created_at).toLocaleString("th-TH")}
            </p>
          </div>
        ))}
        {notes?.length === 0 && (
          <p className="text-sm text-slate-400">ยังไม่มีบันทึก</p>
        )}
      </div>
    </div>
  );
}
