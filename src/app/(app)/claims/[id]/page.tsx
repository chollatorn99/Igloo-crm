import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import { updateClaim, addClaimNote, deleteClaim } from "../actions";
import { CLAIM_STAGES, CLAIM_STATUS_LABEL } from "../stages";

type Claim = Record<string, string | number | null> & { id: string; status: string; customer_id: string; created_by: string | null };

export default async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();

  const { data: claim } = await supabase
    .from("claims")
    .select("*, customer:customers(id, name), owner:profiles!claims_owner_id_fkey(full_name)")
    .eq("id", id)
    .single();
  if (!claim) notFound();
  const c = claim as unknown as Claim & { customer: { id: string; name: string } | null; owner: { full_name: string } | null };

  const { data: pols } = await supabase
    .from("policies")
    .select("id, policy_detail, category:policy_categories(name), insurance_company")
    .eq("customer_id", c.customer_id)
    .order("created_at", { ascending: false });
  const { data: notes } = await supabase
    .from("claim_notes")
    .select("id, note_text, created_at, author:profiles(full_name)")
    .eq("claim_id", id)
    .order("created_at", { ascending: false });

  const save = updateClaim.bind(null, id);
  const addNote = addClaimNote.bind(null, id);
  const removeClaim = deleteClaim.bind(null, id);
  const canDelete = me?.role === "manager" || c.created_by === user!.id;
  const field = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";
  const lbl = "mb-1 block text-xs font-medium text-slate-600";

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Link href="/claims" className="mb-4 inline-block text-xs text-slate-500 hover:underline">← กลับรายการเคลม</Link>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            เคลม: <Link href={`/customers/${c.customer?.id}`} className="hover:underline">{c.customer?.name ?? "-"}</Link>
          </h1>
          <p className="text-xs text-slate-500">
            {c.claim_number ? `เลขเคลม ${c.claim_number} · ` : ""}สถานะ: {CLAIM_STATUS_LABEL[c.status] ?? c.status} · เจ้าของ {c.owner?.full_name ?? "-"}
          </p>
        </div>
        {canDelete && (
          <ActionForm action={removeClaim} confirmMessage="ลบเคลมนี้?">
            <button className="rounded-md bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100">🗑️ ลบเคลม</button>
          </ActionForm>
        )}
      </div>

      <ActionForm action={save} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>เลขที่เคลม</label>
            <input name="claim_number" defaultValue={(c.claim_number as string) ?? ""} className={field} />
          </div>
          <div>
            <label className={lbl}>สถานะปัจจุบัน</label>
            <select name="status" defaultValue={c.status} className={field}>
              {Object.entries(CLAIM_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>กรมธรรม์ที่เกี่ยวข้อง</label>
            <select name="policy_id" defaultValue={(c.policy_id as string) ?? ""} className={field}>
              <option value="">— ไม่ระบุ —</option>
              {(pols ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {[(p.category as unknown as { name: string } | null)?.name, p.insurance_company, p.policy_detail].filter(Boolean).join(" · ") || "กรมธรรม์"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>ยอดเคลม</label>
            <input type="number" step="0.01" name="claim_amount" defaultValue={(c.claim_amount as number) ?? ""} className={field} />
          </div>
        </div>

        <div>
          <label className={lbl}>รายละเอียดเคลม</label>
          <textarea name="detail" rows={2} defaultValue={(c.detail as string) ?? ""} className={field} />
        </div>

        {/* Stage timeline — a date per process step */}
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold text-slate-600">ขั้นตอนการเคลม (ใส่วันที่แต่ละขั้น)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CLAIM_STAGES.map((st, i) => (
              <div key={st.key}>
                <label className={lbl}>{i + 1}. {st.label}</label>
                <input type="date" name={st.date} defaultValue={(c[st.date] as string) ?? ""} className={field} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <label className="mb-1 block text-xs font-semibold text-amber-800">⏰ ติดตามครั้งถัดไป (ตั้งวันเพื่อให้เด้งเตือน)</label>
          <input type="date" name="next_followup_date" defaultValue={(c.next_followup_date as string) ?? ""} className={field} />
        </div>

        <input type="hidden" name="notes" value={(c.notes as string) ?? ""} />
        <button type="submit" className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800">บันทึกการแก้ไข</button>
      </ActionForm>

      {/* Note log */}
      <ActionForm action={addNote} className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-1 block text-xs font-medium text-slate-600">บันทึกการติดตามเคลม</label>
        <textarea name="note_text" required rows={2} className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500" />
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">บันทึก</button>
      </ActionForm>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-700">ประวัติการติดตามเคลม</h2>
      <div className="space-y-3">
        {(notes ?? []).map((n) => (
          <div key={n.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <p className="text-slate-800">{n.note_text}</p>
            <p className="mt-1 text-xs text-slate-400">
              {(n.author as unknown as { full_name: string } | null)?.full_name ?? "-"} · {new Date(n.created_at).toLocaleString("th-TH")}
            </p>
          </div>
        ))}
        {(notes ?? []).length === 0 && <p className="text-sm text-slate-400">ยังไม่มีบันทึก</p>}
      </div>
    </div>
  );
}
