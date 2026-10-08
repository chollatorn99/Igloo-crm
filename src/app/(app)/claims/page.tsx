import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CLAIM_STAGES, CLAIM_STATUS_LABEL } from "./stages";
import { ClaimsExport } from "./claims-export";

type ClaimRow = {
  id: string;
  claim_number: string | null;
  claimant_name: string | null;
  status: string;
  detail: string | null;
  reported_date: string | null;
  paid_date: string | null;
  next_followup_date: string | null;
  claim_amount: number | null;
  customer: { name: string } | null;
  owner: { full_name: string } | null;
};

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
const DONE = ["paid", "rejected"];
const PALETTE = ["#2563eb", "#0891b2", "#7c3aed", "#d97706", "#db2777", "#16a34a", "#dc2626", "#64748b"];

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; view?: string }>;
}) {
  const { q, status, view } = await searchParams;
  const supabase = await createClient();
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";

  // Fetch all visible claims once (RLS-scoped) → summary + filtered table in JS.
  const { data } = await supabase
    .from("claims")
    .select("id, claim_number, claimant_name, status, detail, reported_date, paid_date, next_followup_date, claim_amount, customer:customers!inner(name), owner:profiles!claims_owner_id_fkey(full_name)")
    .order("next_followup_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(2000);
  const all = (data ?? []) as unknown as ClaimRow[];

  // ----- summary -----
  const isOpen = (c: ClaimRow) => !DONE.includes(c.status);
  const openClaims = all.filter(isOpen);
  const overdue = all.filter((c) => isOpen(c) && c.next_followup_date != null && c.next_followup_date <= today);
  const paidThisMonth = all.filter((c) => c.status === "paid" && c.paid_date != null && c.paid_date >= monthStart && c.paid_date <= today);
  const openAmount = openClaims.reduce((s, c) => s + Number(c.claim_amount ?? 0), 0);
  // Average days reported → paid (settlement speed).
  const paidWithDates = all.filter((c) => c.status === "paid" && c.paid_date && c.reported_date);
  const avgDays = paidWithDates.length
    ? Math.round(paidWithDates.reduce((s, c) => s + (new Date(c.paid_date!).getTime() - new Date(c.reported_date!).getTime()) / 86400e3, 0) / paidWithDates.length)
    : null;

  const statusCounts = new Map<string, number>();
  for (const c of all) statusCounts.set(c.status, (statusCounts.get(c.status) ?? 0) + 1);
  const statusOrder = [...CLAIM_STAGES.map((s) => s.key), "rejected"];
  const maxStatus = Math.max(1, ...statusOrder.map((k) => statusCounts.get(k) ?? 0));

  // ----- filtered table -----
  let rows = all;
  if (status) rows = rows.filter((c) => c.status === status);
  if (q?.trim()) { const t = q.trim().toLowerCase(); rows = rows.filter((c) => (c.customer?.name ?? "").toLowerCase().includes(t)); }
  if (view === "followup") rows = rows.filter((c) => isOpen(c) && c.next_followup_date != null && c.next_followup_date <= today);

  const exportRows = rows.map((c, i) => ({
    "ลำดับ": i + 1,
    "ลูกค้า": c.customer?.name ?? "",
    "ผู้ทำเคลม": c.claimant_name ?? "",
    "เลขเคลม": c.claim_number ?? "",
    "สถานะ": CLAIM_STATUS_LABEL[c.status] ?? c.status,
    "แจ้งเคลม": c.reported_date ?? "",
    "จ่าย/จบ": c.paid_date ?? "",
    "ติดตามถัดไป": c.next_followup_date ?? "",
    "ยอดเคลม": c.claim_amount ?? 0,
    "เจ้าของ": c.owner?.full_name ?? "",
  }));

  const Card = ({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold ${accent ?? "text-slate-900"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
  const isOverdue = (d: string | null, done: boolean) => d != null && d <= today && !done;

  return (
    <div className="p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Dashboard เคลม (Claims)</h1>
          <p className="text-xs text-slate-500">{all.length} เคลม — เห็นตามสิทธิ์ของบัญชีคุณ</p>
        </div>
        <div className="flex gap-2">
          <ClaimsExport rows={exportRows} />
          <Link href="/claims/new" className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            + แจ้งเคลมใหม่
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card label="เคลมเปิดอยู่" value={`${openClaims.length}`} sub="ยังไม่จบ" />
        <Link href="/claims?view=followup" className="block hover:opacity-80">
          <Card label="ค้างติดตาม (คลิก)" value={`${overdue.length}`} accent="text-rose-600" sub="เลยวันติดตาม" />
        </Link>
        <Link href="/claims?status=paid" className="block hover:opacity-80">
          <Card label="จ่าย/จบ เดือนนี้ (คลิก)" value={`${paidThisMonth.length}`} accent="text-emerald-700" />
        </Link>
        <Card label="ยอดเคลมที่เปิดอยู่" value={`${baht(openAmount)}`} sub="บาท (ประมาณ)" />
        <Card label="เวลาเฉลี่ยจนจ่าย" value={avgDays != null ? `${avgDays} วัน` : "-"} sub={`จาก ${paidWithDates.length} เคลมที่จบ`} />
      </div>

      {/* Status funnel */}
      <h2 className="mb-2 text-sm font-semibold text-slate-600">เคลมตามสถานะ — คลิกเพื่อกรอง</h2>
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="space-y-1.5">
          {statusOrder.map((k, i) => {
            const cnt = statusCounts.get(k) ?? 0;
            return (
              <Link key={k} href={`/claims?status=${k}`} className="flex items-center gap-3 rounded-md p-1 text-sm hover:bg-slate-50">
                <div className="w-32 shrink-0 truncate text-slate-700">{CLAIM_STATUS_LABEL[k]}</div>
                <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                  <div className="h-full rounded" style={{ width: `${(cnt / maxStatus) * 100}%`, background: k === "paid" ? "#16a34a" : k === "rejected" ? "#dc2626" : PALETTE[i % PALETTE.length] }} />
                </div>
                <div className="w-16 shrink-0 text-right font-mono text-xs text-slate-600">{cnt} ราย</div>
              </Link>
            );
          })}
        </div>
      </div>

      {(overdue.length > 0 && view !== "followup") && (
        <Link href="/claims?view=followup" className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 hover:bg-amber-100">
          ⏰ มีเคลมที่ถึงกำหนดติดตาม {overdue.length} รายการ — คลิกเพื่อดู
        </Link>
      )}

      {/* Filters */}
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q ?? ""} placeholder="ค้นหาชื่อลูกค้า" className="w-48 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500" />
        <select name="status" defaultValue={status ?? ""} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">ทุกสถานะ</option>
          {Object.entries(CLAIM_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600">
          <input type="checkbox" name="view" value="followup" defaultChecked={view === "followup"} className="h-4 w-4" />
          เฉพาะที่ค้างติดตาม
        </label>
        <button className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800">กรอง</button>
      </form>

      {/* Table */}
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
                    {c.claimant_name && <p className="text-xs text-slate-400">ผู้ทำเคลม: {c.claimant_name}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.claim_number ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "paid" ? "bg-emerald-100 text-emerald-700" : c.status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700"}`}>
                      {CLAIM_STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.reported_date ?? "-"}</td>
                  <td className={`px-4 py-3 ${isOverdue(c.next_followup_date, done) ? "font-semibold text-rose-600" : "text-slate-600"}`}>
                    {c.next_followup_date ?? "-"}{isOverdue(c.next_followup_date, done) ? " ⏰" : ""}
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
