import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addFollowUpNote } from "./actions";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, phone, customer_type, call_count, last_call_result, owner:profiles(full_name)")
    .eq("id", id)
    .single();

  if (!customer) notFound();

  const { data: notes } = await supabase
    .from("follow_up_notes")
    .select("id, note_text, created_at, author:profiles(full_name)")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  const addNote = addFollowUpNote.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-slate-900">{customer.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {customer.customer_type === "organization" ? "องค์กร" : "บุคคล"} ·{" "}
          {customer.phone ?? "ไม่มีเบอร์โทร"} · เจ้าของ:{" "}
          {(customer.owner as { full_name: string } | null)?.full_name ?? "-"}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          โทรไปแล้ว {customer.call_count} ครั้ง
          {customer.last_call_result ? ` · ล่าสุด: ${customer.last_call_result}` : ""}
        </p>
      </div>

      <form action={addNote} className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
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
      </form>

      <h2 className="mb-3 text-sm font-semibold text-slate-700">ประวัติการติดตาม</h2>
      <div className="space-y-3">
        {notes?.map((n) => (
          <div key={n.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <p className="text-slate-800">{n.note_text}</p>
            <p className="mt-1 text-xs text-slate-400">
              {(n.author as { full_name: string } | null)?.full_name ?? "-"} ·{" "}
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
