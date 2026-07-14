import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Pagination } from "@/components/Pagination";
import { LazyExportButton } from "./lazy-export-button";

// One row per customer, pre-aggregated by the customer_winback DB view — so
// this page fetches a single 50-row slice instead of pulling ~6,000 policies
// and aggregating in JS on every load.
type ViewRow = {
  customer_id: string;
  name: string;
  phone: string | null;
  total_premium: number | null;
  latest_year: number | null;
  years_count: number | null;
  active: boolean;
  not_renewed: boolean;
  renewed: boolean;
  last_category: string | null;
  last_insurer: string | null;
  last_premium: number | null;
  last_coverage_end: string | null;
  anniv_offset: number | null;
};

const PAGE_SIZE = 50;
type SortKey = "renewal" | "latest" | "premium" | "years" | "name";
const SORT_COL: Record<SortKey, string> = {
  renewal: "anniv_offset",
  latest: "latest_year",
  premium: "total_premium",
  years: "years_count",
  name: "name",
};
const DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = {
  renewal: "asc",
  name: "asc",
  latest: "desc",
  premium: "desc",
  years: "desc",
};

const dayMonth = (s: string | null) => {
  if (!s) return "-";
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    category_id?: string;
    status?: string;
    sort?: string;
    dir?: string;
    page?: string;
    q?: string;
  }>;
}) {
  const { year, category_id, status, sort, dir, page: pageParam, q } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const sortKey: SortKey = (["renewal", "latest", "premium", "years", "name"] as const).includes(sort as SortKey)
    ? (sort as SortKey)
    : "renewal";
  const dirEff: "asc" | "desc" = dir === "asc" ? "asc" : dir === "desc" ? "desc" : DEFAULT_DIR[sortKey];
  const desc = dirEff === "desc";
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  const canExport = me?.role !== "sales";

  const { data: categories } = await supabase.from("policy_categories").select("id, name").order("name");

  let query = supabase
    .from("customer_winback")
    .select("*", { count: "exact" })
    .order(SORT_COL[sortKey], { ascending: !desc })
    .order("customer_id"); // stable tiebreak
  if (status === "lapsed") query = query.eq("active", false);
  else if (status === "active") query = query.eq("active", true);
  else if (status === "renewed") query = query.eq("renewed", true);
  else if (status === "not_renewed") query = query.eq("not_renewed", true);
  if (year) query = query.eq("latest_year", Number(year));
  if (category_id) query = query.eq("last_category_id", category_id);
  if (q?.trim()) query = query.ilike("name", `%${q.trim().replace(/[%,()]/g, "")}%`);
  query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data, count } = await query;
  const rows = (data ?? []) as ViewRow[];
  const total = count ?? 0;

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2017 }, (_, i) => currentYear - i);

  const SortHeader = ({ label, col }: { label: string; col: SortKey }) => {
    const sp = new URLSearchParams();
    if (year) sp.set("year", year);
    if (category_id) sp.set("category_id", category_id);
    if (status) sp.set("status", status);
    if (q) sp.set("q", q);
    const active = sortKey === col;
    sp.set("sort", col);
    sp.set("dir", active ? (dirEff === "asc" ? "desc" : "asc") : DEFAULT_DIR[col]);
    const arrow = active ? (desc ? " ↓" : " ↑") : "";
    return (
      <th className="px-4 py-3">
        <Link href={`?${sp.toString()}`} className="hover:text-slate-800">
          {label}
          {arrow}
        </Link>
      </th>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">ลูกค้าเก่า / โทรกลับ (Win-back)</h1>
          <p className="text-xs text-slate-500">
            {total.toLocaleString()} ลูกค้า
            {status === "lapsed" ? " · เฉพาะที่ขาดต่ออายุ" : status === "active" ? " · เฉพาะ Active" : status === "renewed" ? " · เฉพาะที่ต่อแล้ว" : status === "not_renewed" ? " · เฉพาะที่ทำเครื่องหมายไม่ต่อ" : ""}
          </p>
        </div>
        {canExport && <LazyExportButton filters={{ status, year, category_id, q }} />}
      </div>
      <p className="mb-4 text-xs text-slate-400">
        รายชื่อลูกค้าที่เคยซื้อประกัน — ใช้โทรกลับเสนอขายลูกค้าเก่า (กรอง &quot;ขาดต่ออายุ&quot; เพื่อดูเฉพาะที่ยังไม่ต่อ) ·
        เรียงตามวัน/เดือนที่ครบกำหนดต่ออายุ (ไม่สนปี) เอาที่ใกล้ถึงรอบต่ออายุหลังวันนี้มาก่อน เหมือนหน้าแจ้งเตือนต่ออายุ
      </p>

      <form className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="ค้นหาชื่อลูกค้า"
          className="w-48 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        />
        <select name="status" defaultValue={status ?? ""} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">สถานะ: ทั้งหมด</option>
          <option value="lapsed">ขาดต่ออายุ (ควรโทรกลับ)</option>
          <option value="active">Active (ยังมีผลอยู่)</option>
          <option value="renewed">ต่อแล้ว (renewed)</option>
          <option value="not_renewed">ทำเครื่องหมาย &quot;ไม่ต่อ&quot;</option>
        </select>
        <select name="year" defaultValue={year ?? ""} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">ทุกปี (ปีที่ซื้อล่าสุด)</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          name="category_id"
          defaultValue={category_id ?? ""}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">ทุกประเภท (ล่าสุด)</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
          กรอง
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <SortHeader label="ลูกค้า" col="name" />
              <th className="px-4 py-3">เบอร์โทร</th>
              <th className="px-4 py-3">ประเภทล่าสุด</th>
              <SortHeader label="หมดอายุ (ว/ด)" col="renewal" />
              <SortHeader label="ปีที่ซื้อล่าสุด" col="latest" />
              <SortHeader label="จำนวนปีที่ซื้อ" col="years" />
              <th className="px-4 py-3">บ.ประกันหลังสุด</th>
              <th className="px-4 py-3">เบี้ยหลังสุด</th>
              <th className="px-4 py-3">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.customer_id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/customers/${r.customer_id}`} className="font-medium text-slate-900 hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.phone ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{r.last_category ?? "-"}</td>
                <td className="px-4 py-3 font-mono text-slate-600">{dayMonth(r.last_coverage_end)}</td>
                <td className="px-4 py-3 text-slate-600">{r.latest_year ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{r.years_count ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{r.last_insurer ?? "-"}</td>
                <td className="px-4 py-3 font-mono text-slate-600">{Number(r.last_premium ?? 0).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.not_renewed
                        ? "bg-rose-100 text-rose-700"
                        : r.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {r.not_renewed ? "ไม่ต่อ" : r.active ? "Active" : "ขาดต่ออายุ"}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                  ไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} params={{ year, category_id, status, sort, dir, q }} />
    </div>
  );
}
