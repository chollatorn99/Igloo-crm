import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetchAll";
import { Pagination } from "@/components/Pagination";
import { ExportButton } from "@/app/(app)/payments/export-button";

type HistoryPolicyRow = {
  id: string;
  closed_date: string;
  coverage_end_date: string | null;
  net_premium: number | null;
  category_id: string;
  renewal_outcome: string;
  insurance_company: string | null;
  category: { name: string } | null;
  customer: { id: string; name: string; phone: string | null } | null;
};

type CustomerAgg = {
  customer: { id: string; name: string; phone: string | null };
  years: Set<number>;
  latestYear: number;
  active: boolean;
  notRenewed: boolean;
  totalPremium: number;
  count: number;
  // From the newest policy (rows arrive ordered by closed_date desc, so the
  // first one seen per customer is the latest).
  lastCategory: string;
  lastInsurer: string;
  lastPremium: number;
};

const PAGE_SIZE = 50;
type SortKey = "latest" | "premium" | "years" | "name";

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
  }>;
}) {
  const { year, category_id, status, sort, dir, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const sortKey: SortKey = (["latest", "premium", "years", "name"] as const).includes(sort as SortKey)
    ? (sort as SortKey)
    : "latest";
  const desc = dir !== "asc";
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  const canExport = me?.role !== "sales";

  const { data: categories } = await supabase.from("policy_categories").select("id, name").order("name");

  const policies = await fetchAll<HistoryPolicyRow>((from, to) => {
    let query = supabase
      .from("policies")
      .select(
        "id, closed_date, coverage_end_date, net_premium, category_id, renewal_outcome, insurance_company, category:policy_categories(name), customer:customers(id, name, phone)",
      )
      .eq("deal_status", "win")
      .not("closed_date", "is", null)
      .order("closed_date", { ascending: false })
      .range(from, to);
    if (category_id) query = query.eq("category_id", category_id);
    if (year) query = query.gte("closed_date", `${year}-01-01`).lte("closed_date", `${year}-12-31`);
    return query as unknown as PromiseLike<{ data: HistoryPolicyRow[] | null; error: { message: string } | null }>;
  });

  const today = new Date();
  const byCustomer = new Map<string, CustomerAgg>();

  for (const p of policies) {
    const customer = p.customer;
    if (!customer) continue;
    const y = new Date(p.closed_date).getFullYear();
    const isActive = p.coverage_end_date ? new Date(p.coverage_end_date) >= today : false;

    let entry = byCustomer.get(customer.id);
    if (!entry) {
      // First row for this customer = newest policy (desc order).
      entry = {
        customer,
        years: new Set<number>(),
        latestYear: y,
        active: false,
        notRenewed: false,
        totalPremium: 0,
        count: 0,
        lastCategory: p.category?.name ?? "-",
        lastInsurer: p.insurance_company ?? "-",
        lastPremium: Number(p.net_premium ?? 0),
      };
      byCustomer.set(customer.id, entry);
    }
    entry.years.add(y);
    entry.latestYear = Math.max(entry.latestYear, y);
    entry.active = entry.active || isActive;
    entry.notRenewed = entry.notRenewed || p.renewal_outcome === "not_renewed";
    entry.totalPremium += Number(p.net_premium ?? 0);
    entry.count += 1;
  }

  let allRows = [...byCustomer.values()];
  // Status filter — "lapsed" (ขาดการต่ออายุ) is the win-back call list.
  if (status === "lapsed") allRows = allRows.filter((r) => !r.active);
  else if (status === "active") allRows = allRows.filter((r) => r.active);
  else if (status === "not_renewed") allRows = allRows.filter((r) => r.notRenewed);

  const cmp: Record<SortKey, (a: CustomerAgg, b: CustomerAgg) => number> = {
    latest: (a, b) => a.latestYear - b.latestYear,
    premium: (a, b) => a.totalPremium - b.totalPremium,
    years: (a, b) => a.years.size - b.years.size,
    name: (a, b) => a.customer.name.localeCompare(b.customer.name, "th"),
  };
  allRows.sort((a, b) => (desc ? -1 : 1) * cmp[sortKey](a, b));

  const total = allRows.length;
  const rows = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const yearOptions = [...new Set(policies.map((p) => new Date(p.closed_date).getFullYear()))].sort((a, b) => b - a);

  const statusLabel = (r: CustomerAgg) =>
    r.notRenewed ? "ไม่ต่อ (ทำเครื่องหมาย)" : r.active ? "Active" : "ขาดการต่ออายุ";

  const exportRows = allRows.map((r) => ({
    ลูกค้า: r.customer.name,
    เบอร์โทร: r.customer.phone,
    ประเภทล่าสุด: r.lastCategory,
    ปีที่ซื้อล่าสุด: r.latestYear,
    จำนวนปีที่ซื้อ: r.years.size,
    บริษัทประกันหลังสุด: r.lastInsurer,
    เบี้ยหลังสุด: r.lastPremium,
    สถานะ: statusLabel(r),
  }));

  const SortHeader = ({ label, col }: { label: string; col: SortKey }) => {
    const sp = new URLSearchParams();
    if (year) sp.set("year", year);
    if (category_id) sp.set("category_id", category_id);
    if (status) sp.set("status", status);
    sp.set("sort", col);
    sp.set("dir", sortKey === col && desc ? "asc" : "desc");
    const arrow = sortKey === col ? (desc ? " ↓" : " ↑") : "";
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
            {status === "lapsed" ? " · เฉพาะที่ขาดต่ออายุ" : status === "active" ? " · เฉพาะ Active" : status === "not_renewed" ? " · เฉพาะที่ทำเครื่องหมายไม่ต่อ" : ""}
          </p>
        </div>
        {canExport && (
          <ExportButton
            rows={exportRows}
            filename="win-back"
            exportType="win-back"
            filterNote={[year && `ปี ${year}`, category_id && "กรองประเภท", status].filter(Boolean).join(", ") || undefined}
          />
        )}
      </div>
      <p className="mb-4 text-xs text-slate-400">
        รายชื่อลูกค้าที่เคยซื้อประกัน — ใช้โทรกลับเสนอขายลูกค้าเก่า (กรอง &quot;ขาดต่ออายุ&quot; เพื่อดูเฉพาะที่ยังไม่ต่อ)
      </p>

      <form className="mb-4 flex flex-wrap gap-2">
        <select name="status" defaultValue={status ?? ""} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">สถานะ: ทั้งหมด</option>
          <option value="lapsed">ขาดต่ออายุ (ควรโทรกลับ)</option>
          <option value="active">Active (ยังมีผลอยู่)</option>
          <option value="not_renewed">ทำเครื่องหมาย &quot;ไม่ต่อ&quot;</option>
        </select>
        <select name="year" defaultValue={year ?? ""} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">ทุกปี</option>
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
          <option value="">ทุกประเภท</option>
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
              <SortHeader label="ปีที่ซื้อล่าสุด" col="latest" />
              <SortHeader label="จำนวนปีที่ซื้อ" col="years" />
              <th className="px-4 py-3">บ.ประกันหลังสุด</th>
              <th className="px-4 py-3">เบี้ยหลังสุด</th>
              <th className="px-4 py-3">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.customer.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/customers/${r.customer.id}`} className="font-medium text-slate-900 hover:underline">
                    {r.customer.name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.customer.phone ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{r.lastCategory}</td>
                <td className="px-4 py-3 text-slate-600">{r.latestYear}</td>
                <td className="px-4 py-3 text-slate-600">{r.years.size}</td>
                <td className="px-4 py-3 text-slate-600">{r.lastInsurer}</td>
                <td className="px-4 py-3 font-mono text-slate-600">{r.lastPremium.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.notRenewed
                        ? "bg-rose-100 text-rose-700"
                        : r.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {r.notRenewed ? "ไม่ต่อ" : r.active ? "Active" : "ขาดต่ออายุ"}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  ไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} params={{ year, category_id, status, sort, dir }} />
    </div>
  );
}
