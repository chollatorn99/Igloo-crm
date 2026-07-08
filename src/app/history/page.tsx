import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExportButton } from "@/app/payments/export-button";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; category_id?: string }>;
}) {
  const { year, category_id } = await searchParams;
  const supabase = await createClient();

  const { data: categories } = await supabase.from("policy_categories").select("id, name").order("name");

  let query = supabase
    .from("policies")
    .select(
      "id, closed_date, coverage_end_date, net_premium, category_id, category:policy_categories(name), customer:customers(id, name, phone, owner_id)",
    )
    .eq("deal_status", "win")
    .not("closed_date", "is", null)
    .order("closed_date", { ascending: false });

  if (category_id) query = query.eq("category_id", category_id);
  if (year) query = query.gte("closed_date", `${year}-01-01`).lte("closed_date", `${year}-12-31`);

  const { data: policies } = await query;

  const today = new Date();
  const byCustomer = new Map<
    string,
    {
      customer: { id: string; name: string; phone: string | null };
      years: Set<number>;
      latestYear: number;
      active: boolean;
      totalPremium: number;
      count: number;
    }
  >();

  for (const p of policies ?? []) {
    const customer = p.customer as { id: string; name: string; phone: string | null };
    const y = new Date(p.closed_date as string).getFullYear();
    const isActive = p.coverage_end_date ? new Date(p.coverage_end_date) >= today : false;

    const entry = byCustomer.get(customer.id) ?? {
      customer,
      years: new Set<number>(),
      latestYear: y,
      active: false,
      totalPremium: 0,
      count: 0,
    };
    entry.years.add(y);
    entry.latestYear = Math.max(entry.latestYear, y);
    entry.active = entry.active || isActive;
    entry.totalPremium += Number(p.net_premium ?? 0);
    entry.count += 1;
    byCustomer.set(customer.id, entry);
  }

  const rows = [...byCustomer.values()].sort((a, b) => b.latestYear - a.latestYear);

  const yearOptions = [...new Set((policies ?? []).map((p) => new Date(p.closed_date as string).getFullYear()))].sort(
    (a, b) => b - a,
  );

  const exportRows = rows.map((r) => ({
    ลูกค้า: r.customer.name,
    เบอร์โทร: r.customer.phone,
    ปีที่ซื้อล่าสุด: r.latestYear,
    จำนวนปีที่ซื้อ: r.years.size,
    จำนวนกรมธรรม์: r.count,
    ยอดเบี้ยรวม: r.totalPremium,
    สถานะ: r.active ? "Active" : "ขาดการต่ออายุ",
  }));

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">ประวัติลูกค้าเก่า / Win-back</h1>
          <p className="text-xs text-slate-500">{rows.length} ลูกค้า</p>
        </div>
        <ExportButton rows={exportRows} filename="customer-history" />
      </div>

      <form className="mb-4 flex gap-2">
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ลูกค้า</th>
              <th className="px-4 py-3">เบอร์โทร</th>
              <th className="px-4 py-3">ปีที่ซื้อล่าสุด</th>
              <th className="px-4 py-3">จำนวนปีที่ซื้อ</th>
              <th className="px-4 py-3">ยอดเบี้ยรวม</th>
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
                      r.active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {r.active ? "Active" : "ขาดการต่ออายุ"}
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
    </div>
  );
}
