import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Pagination } from "@/components/Pagination";

type Row = {
  id: string;
  action: string;
  summary: string;
  customer_id: string | null;
  created_at: string;
  actor: { full_name: string } | null;
};

const PAGE_SIZE = 50;

// Colour + short label per action for the badge. summary already carries the
// full human text, so this is just a quick visual tag.
const ACTION_META: Record<string, { label: string; cls: string }> = {
  customer_created: { label: "เพิ่มลูกค้า", cls: "bg-sky-100 text-sky-700" },
  policy_created: { label: "เพิ่มกรมธรรม์", cls: "bg-sky-100 text-sky-700" },
  deal_won: { label: "ปิด Win", cls: "bg-emerald-100 text-emerald-700" },
  deal_lost: { label: "ปิด Lost", cls: "bg-rose-100 text-rose-700" },
  renewed: { label: "ต่ออายุ", cls: "bg-emerald-100 text-emerald-700" },
  renewal_renewed: { label: "ต่อแล้ว", cls: "bg-emerald-100 text-emerald-700" },
  renewal_not_renewed: { label: "ไม่ต่อ", cls: "bg-rose-100 text-rose-700" },
  renewal_pending: { label: "ล้างสถานะ", cls: "bg-slate-100 text-slate-600" },
  policy_deleted: { label: "ลบกรมธรรม์", cls: "bg-red-100 text-red-700" },
  payment_reported: { label: "แจ้งชำระ", cls: "bg-amber-100 text-amber-700" },
  payment_verified: { label: "ยืนยันชำระ", cls: "bg-emerald-100 text-emerald-700" },
  payment_rejected: { label: "สลิปไม่ผ่าน", cls: "bg-rose-100 text-rose-700" },
  call_logged: { label: "ติดตาม/โทร", cls: "bg-indigo-100 text-indigo-700" },
};

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; from?: string; to?: string; action?: string; page?: string }>;
}) {
  const { actor, from, to, action, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  const isManager = me?.role === "manager";

  // Manager can filter by person; RLS already scopes sales to their own rows.
  const people = isManager
    ? (await supabase.from("profiles").select("id, full_name").in("role", ["sales", "manager"]).order("full_name")).data
    : null;

  let query = supabase
    .from("activity_log")
    .select("id, action, summary, customer_id, created_at, actor:profiles!activity_log_actor_id_fkey(full_name)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (isManager && actor) query = query.eq("actor_id", actor);
  if (action) query = query.eq("action", action);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;

  // activity_log.summary stores only the first 60 chars of a follow-up note, so
  // pull the full text from follow_up_notes for the call_logged rows on screen
  // and match by customer + near-identical timestamp (note is inserted moments
  // before its activity row).
  const noteCustomerIds = [...new Set(rows.filter((r) => r.action === "call_logged" && r.customer_id).map((r) => r.customer_id!))];
  const notesByCustomer = new Map<string, { note_text: string; created_at: string }[]>();
  if (noteCustomerIds.length) {
    const { data: notes } = await supabase
      .from("follow_up_notes")
      .select("customer_id, note_text, created_at")
      .in("customer_id", noteCustomerIds)
      .order("created_at", { ascending: false });
    for (const n of (notes ?? []) as { customer_id: string; note_text: string; created_at: string }[]) {
      if (!notesByCustomer.has(n.customer_id)) notesByCustomer.set(n.customer_id, []);
      notesByCustomer.get(n.customer_id)!.push(n);
    }
  }
  const fullSummary = (r: Row) => {
    if (r.action !== "call_logged" || !r.customer_id) return r.summary;
    const notes = notesByCustomer.get(r.customer_id) ?? [];
    const t = new Date(r.created_at).getTime();
    let best: { note_text: string; created_at: string } | null = null;
    let bestGap = 60000; // within 60s
    for (const n of notes) {
      const gap = Math.abs(new Date(n.created_at).getTime() - t);
      if (gap < bestGap) { bestGap = gap; best = n; }
    }
    return best ? `${r.summary.split("—")[0].trim()} — ${best.note_text}` : r.summary;
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="p-8">
      <div className="mb-1">
        <h1 className="text-lg font-semibold text-slate-900">บันทึกกิจกรรม (Activity)</h1>
        <p className="text-xs text-slate-500">
          {total.toLocaleString()} รายการ · {isManager ? "ทุกคนในทีม" : "กิจกรรมของคุณ"}
        </p>
      </div>
      <p className="mb-4 text-xs text-slate-400">
        บันทึกทุกการกระทำสำคัญพร้อมผู้ทำและเวลา — เพิ่ม/ปิดดีล/ต่ออายุ/ลบกรมธรรม์/ชำระเงิน/ติดตามลูกค้า
      </p>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        {isManager && (
          <select name="actor" defaultValue={actor ?? ""} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">ทุกคน</option>
            {people?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        )}
        <select name="action" defaultValue={action ?? ""} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">ทุกประเภท</option>
          <option value="call_logged">ติดตาม/โทร (Follow-up)</option>
          <option value="renewed">ต่ออายุ</option>
          <option value="deal_won">ปิด Win</option>
          <option value="deal_lost">ปิด Lost</option>
          <option value="payment_reported">แจ้งชำระ</option>
        </select>
        <input type="date" name="from" defaultValue={from ?? ""} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        <span className="text-xs text-slate-400">ถึง</span>
        <input type="date" name="to" defaultValue={to ?? ""} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        <button className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800">กรอง</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">เวลา</th>
              {isManager && <th className="px-4 py-3">ผู้ทำ</th>}
              <th className="px-4 py-3">การกระทำ</th>
              <th className="px-4 py-3">รายละเอียด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const meta = ACTION_META[r.action] ?? { label: r.action, cls: "bg-slate-100 text-slate-600" };
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmt(r.created_at)}</td>
                  {isManager && <td className="px-4 py-3 text-slate-700">{r.actor?.full_name ?? "-"}</td>}
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.customer_id ? (
                      <Link href={`/customers/${r.customer_id}`} className="hover:underline">
                        {fullSummary(r)}
                      </Link>
                    ) : (
                      fullSummary(r)
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={isManager ? 4 : 3} className="px-4 py-10 text-center text-slate-400">
                  ยังไม่มีกิจกรรมในช่วงที่เลือก
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} params={{ actor, from, to, action }} />
    </div>
  );
}
