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
};

const PAGE_SIZE = 50;
type SortKey = "latest" | "premium" | "years" | "name";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    category_id?: string;
    outcome?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const { year, category_id, outcome, sort, dir, page: pageParam } = await searchParams;
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
        "id, closed_date, coverage_end_date, net_premium, category_id, renewal_outcome, category:policy_categories(name), customer:customers(id, name, phone)",
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

    const entry = byCustomer.get(customer.id) ?? {
      customer,
      years: new Set<number>(),
      latestYear: y,
      active: false,
      notRenewed: false,
      totalPremium: 0,
      count: 0,
    };
    entry.years.add(y);
    entry.latestYear = Math.max(entry.latestYear, y);
    entry.active = entry.active || isActive;
    entry.notRenewed = entry.notRenewed || p.renewal_outcome === "not_renewed";
    entry.totalPremium += Number(p.net_premium ?? 0);
    entry.count += 1;
    byCustomer.set(customer.id, entry);
  }

  let allRows = [...byCustomer.values()];
  if (outcome === "not_renewed") allRows = allRows.filter((r) => r.notRenewed);

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

  const exportRows = allRows.map((r) => ({
    ลูกค้า: r.customer.name,
    เบอร์โทร: r.customer.phone,
    ปีที่ซื้อล่าสุด: r.latestYear,
    จำนวนปีที่ซื้อ: r.years.size,
    จำนวนกรมธรรม์: r.count,
    ยอดเบี้ยรวม: r.totalPremium,
    สถานะ: r.notRenewed ? "ไม่ต่อ" : r.active ? "Active" : "ขาดการต่ออายุ",
  }));

  // Header that links to sort by its column, toggling asc/desc, keeping filters.
  const SortHeader = ({ label, col }: { label: string; col: SortKey }) => {
    const sp = new URLSearchParams();
    if (year) sp.set("year", year);
    if (category_id) sp.set("category_id", category_id);
    if (outcome) sp.set("outcome", outcome);
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">ประวัติลูกค้าเก่า / Win-back</h1>
          <p className="text-xs text-slate-500">
            {total.toLocaleString()} ลูกค้า{outcome === "not_renewed" ? " (เฉพาะที่ไม่ต่อ)" : ""}
          </p>
        </div>
        {canExport && (
          <ExportButton
            rows={exportRows}
            filename="customer-history"
            exportType="history"
            filterNote={
              [year && `ปี ${year}`, category_id && "กรองประเภท", outcome === "not_renewed" && "ไม่ต่อ"]
                .filter(Boolean)
                .join(", ") || undefined
            }
          />
        )}
      </div>

      <form className="mb-4 flex flex-wrap gap-2">
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
        <select name="outcome" defaultValue={outcome ?? ""} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">สถานะต่ออายุ: ทั้งหมด</option>
          <option value="not_renewed">เฉพาะที่ไม่ต่อ</option>
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
              <SortHeader label="ปีที่ซื้อล่าสุด" col="latest" />
              <SortHeader label="จำนวนปีที่ซื้อ" col="years" />
              <SortHeader label="ยอดเบี้ยรวม" col="premium" />
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
                <td className="px-4 py-3 text-slate-600">{r.latestYear}</td>
                <td className="px-4 py-3 text-slate-600">{r.years.size}</td>
                <td className="px-4 py-3 font-mono text-slate-600">{r.totalPremium.toLocaleString()}</td>
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
                    {r.notRenewed ? "ไม่ต่อ" : r.active ? "Active" : "ขาดการต่ออายุ"}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  ไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} params={{ year, category_id, outcome, sort, dir }} />
    </div>
  );
}
