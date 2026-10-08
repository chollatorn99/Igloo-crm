import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CLAIM_STATUS_LABEL } from "./stages";

type ClaimRow = {
  id: string;
  claim_number: string | null;
  status: string;
  reported_date: string | null;
  next_followup_date: string | null;
  paid_date: string | null;
  claim_amount: number | null;
  customer: { name: string } | null;
  owner: { full_name: string } | null;
};

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
const DONE = ["paid", "rejected"];

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; view?: string }>;
}) {
  const { q, status, view } = await searchParams;
  const supabase = await createClient();
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

  let query = supabase
    .from("claims")
    .select("id, claim_number, status, reported_date, next_followup_date, paid_date, claim_amount, customer:customers!inner(name), owner:profiles!claims_owner_id_fkey(full_name)")
    .order("next_followup_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (status) query = query.eq("status", status);
  if (q?.trim()) query = query.ilike("customer.name", `%${q.trim().replace(/[%,()]/g, "")}%`);
  if (view === "followup") query = query.lte("next_followup_date", today).not("status", "in", `(${DONE.join(",")})`);

  const { data } = await query;
  const rows = (data ?? []) as unknown as ClaimRow[];

  // Count claims that need chasing (for the reminder banner) — independent of filter.
  const { count: dueCount } = await supabase
    .from("claims")
    .select("id", { count: "exact", head: true })
    .lte("next_followup_date", today)
    .not("status", "in", `(${DONE.join(",")})`);

  const overdue = (d: string | null, done: boolean) => d != null && d <= today && !done;

  return (
    <div className="p-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">ติดตามเคลม (Claims)</h1>
          <p className="text-xs text-slate-500">{rows.length} เคลม — เห็นตามสิทธิ์ของบัญชีคุณ</p>
        </div>
      </div>

      {(dueCount ?? 0) > 0 && (
        <Link href="/claims?view=followup" className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 hover:bg-amber-100">
          ⏰ มีเคลมที่ถึงกำหนดติดตาม {dueCount} รายการ — คลิกเพื่อดู
        </Link>
      )}

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q ?? ""} placeholder="ค้นหาชื่อลูกค้า" className="w-48 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500" />
        <select name="status" defaultValue={status ?? ""} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">ทุกสถานะ</option>
          {Object.entries(CLAIM_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600">
          <input type="checkbox" name="view" value="followup" defaultChecked={view === "followup"} className="h-4 w-4" />
          เฉพาะที่ค้างติดตาม
        </label>
        <button className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800">กรอง</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ลูกค้า</th>
              <th className="px-4 py-3">เลขเคลม</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">แจ้งเคลมเมื่อ</th>
              <th className="px-4 py-3">ติดตามครั้งถัดไป</th>
              <th className="px-4 py-3">ยอดเคลม</th>
              <th className="px-4 py-3">เจ้าของ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => {
              const done = DONE.includes(c.status);
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/claims/${c.id}`} className="font-medium text-slate-900 hover:underline">{c.customer?.name ?? "-"}</Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.claim_number ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "paid" ? "bg-emerald-100 text-emerald-700" : c.status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700"}`}>
                      {CLAIM_STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.reported_date ?? "-"}</td>
                  <td className={`px-4 py-3 ${overdue(c.next_followup_date, done) ? "font-semibold text-rose-600" : "text-slate-600"}`}>
                    {c.next_followup_date ?? "-"}{overdue(c.next_followup_date, done) ? " ⏰" : ""}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">{c.claim_amount != null ? baht(Number(c.claim_amount)) : "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.owner?.full_name ?? "-"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">ยังไม่มีเคลม — เริ่มจากหน้าลูกค้า กด &quot;+ แจ้งเคลม&quot;</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
