import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, ActionButton } from "@/components/ActionForm";
import { updateClaim, addClaimNote, deleteClaim, addClaimant, updateClaimant, deleteClaimant } from "../actions";
import { CLAIM_STAGES, CLAIM_STATUS_LABEL, CLAIMANT_STATUS_LABEL } from "../stages";

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
  const { data: claimants } = await supabase
    .from("claim_claimants")
    .select("id, name, status, amount, paid_date, note")
    .eq("claim_id", id)
    .order("created_at");

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
            {c.claimant_name ? `ผู้ทำเคลม: ${String(c.claimant_name).split("\n").map((x) => x.trim()).filter(Boolean).join(", ")} · ` : ""}{c.claim_number ? `เลขเคลม ${c.claim_number} · ` : ""}สถานะ: {CLAIM_STATUS_LABEL[c.status] ?? c.status} · เจ้าของ {c.owner?.full_name ?? "-"}
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
          <label className={lbl}>ผู้ทำเคลม (ประกันกลุ่มใส่ได้หลายคน — บรรทัดละชื่อ)</label>
          <textarea name="claimant_name" rows={3} defaultValue={(c.claimant_name as string) ?? ""} placeholder="เว้นว่างได้ถ้าเป็นรายบุคคล · หลายคนให้ขึ้นบรรทัดใหม่" className={field} />
        </div>

        <div>
          <label className={lbl}>รายละเอียดเคลม</label>
          <textarea name="detail" rows={2} defaultValue={(c.detail as string) ?? ""} className={field} />
        </div>

        {/* Stage timeline — a date + note per process step */}
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold text-slate-600">ขั้นตอนการเคลม (ใส่วันที่ + โน้ตแต่ละขั้น)</p>
          <div className="space-y-2">
            {CLAIM_STAGES.map((st, i) => (
              <div key={st.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[13rem_1fr]">
                <div>
                  <label className={lbl}>{i + 1}. {st.label}</label>
                  <input type="date" name={st.date} defaultValue={(c[st.date] as string) ?? ""} className={field} />
                </div>
                <div>
                  <label className={lbl}>โน้ตขั้นนี้</label>
                  <input name={st.note} defaultValue={(c[st.note] as string) ?? ""} placeholder="บันทึกสั้นๆ ของขั้นนี้" className={field} />
                </div>
              </div>
            ))}
            <div className="grid grid-cols-1 gap-2 border-t border-slate-200 pt-2 sm:grid-cols-[13rem_1fr]">
              <div>
                <label className={lbl}>วันรับเอกสารจากลูกค้า</label>
                <input type="date" name="documents_received_date" defaultValue={(c.documents_received_date as string) ?? ""} className={field} />
              </div>
              <div>
                <label className={lbl}>โน้ตเอกสาร</label>
                <input name="documents_received_note" defaultValue={(c.documents_received_note as string) ?? ""} placeholder="เช่น ได้รับครบ / ยังขาดใบเสร็จ" className={field} />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <label className="mb-1 block text-xs font-semibold text-amber-800">⏰ ติดตามครั้งถัดไป (ตั้งวันเพื่อให้เด้งเตือน)</label>
          <input type="date" name="next_followup_date" defaultValue={(c.next_followup_date as string) ?? ""} className={field} />
        </div>

        <input type="hidden" name="notes" value={(c.notes as string) ?? ""} />
        <button type="submit" className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800">บันทึกการแก้ไข</button>
      </ActionForm>

      {/* Per-claimant (group member) lines */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-slate-700">รายคน (ประกันกลุ่ม) — สถานะ/ยอด/วันจ่าย แยกแต่ละคน</p>
        <div className="space-y-2">
          {(claimants ?? []).map((cl) => (
            <div key={cl.id} className="flex items-end gap-1 rounded-md border border-slate-100 p-2">
              <ActionForm action={updateClaimant.bind(null, cl.id, id)} successMessage="บันทึกแล้ว" className="grid flex-1 grid-cols-1 items-end gap-2 sm:grid-cols-[1.4fr_1fr_0.9fr_1fr_1.4fr_auto]">
                <input name="name" defaultValue={cl.name} placeholder="ชื่อ" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                <select name="status" defaultValue={cl.status} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                  {Object.entries(CLAIMANT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input type="number" step="0.01" name="amount" defaultValue={cl.amount ?? ""} placeholder="ยอด" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                <input type="date" name="paid_date" defaultValue={cl.paid_date ?? ""} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                <input name="note" defaultValue={cl.note ?? ""} placeholder="โน้ต" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                <ActionButton label="บันทึก" className="rounded-md bg-slate-900 px-2 py-1.5 text-xs text-white hover:bg-slate-800" />
              </ActionForm>
              <ActionForm action={deleteClaimant.bind(null, cl.id, id)} confirmMessage={`ลบ "${cl.name}"?`}>
                <ActionButton label="ลบ" className="rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700 hover:bg-rose-100" />
              </ActionForm>
            </div>
          ))}
          {(claimants ?? []).length === 0 && <p className="text-xs text-slate-400">ยังไม่มีรายคน — เพิ่มด้านล่าง (สำหรับประกันกลุ่มที่มีหลายคน)</p>}
        </div>

        <ActionForm action={addClaimant.bind(null, id)} resetOnSuccess className="mt-3 grid grid-cols-1 items-end gap-2 border-t border-slate-100 pt-3 sm:grid-cols-[1.4fr_1fr_0.9fr_1fr_1.4fr_auto]">
          <input name="name" required placeholder="+ ชื่อผู้ทำเคลม" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <select name="status" defaultValue="pending" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            {Object.entries(CLAIMANT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="number" step="0.01" name="amount" placeholder="ยอด" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <input type="date" name="paid_date" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <input name="note" placeholder="โน้ต" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <ActionButton label="เพิ่ม" className="rounded-md bg-sky-600 px-2 py-1.5 text-xs text-white hover:bg-sky-700" />
        </ActionForm>
      </div>

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
