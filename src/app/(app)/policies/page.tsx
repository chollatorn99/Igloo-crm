import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetchAll";

type Row = {
  id: string;
  net_premium: number | null;
  closed_date: string | null;
  coverage_end_date: string | null;
  insurance_company: string | null;
  renewal_outcome: string;
  category: { name: string } | null;
  customer: { id: string; name: string } | null;
};

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
const RENEWAL_LABEL: Record<string, string> = { pending: "รอติดตาม", renewed: "ต่อแล้ว", not_renewed: "ไม่ต่อ" };

// Drill-down from the dashboard category bars: individual won policies of a
// category within a date window. Scoped by RLS (sales = own, manager = all).
export default async function PoliciesListPage({
  searchParams,
}: {
  searchParams: Promise<{ category_id?: string; from?: string; to?: string; owner?: string }>;
}) {
  const { category_id, from, to, owner } = await searchParams;
  const supabase = await createClient();

  let categoryName = "";
  if (category_id) {
    const { data } = await supabase.from("policy_categories").select("name").eq("id", category_id).single();
    categoryName = data?.name ?? "";
  }
  let ownerName = "";
  if (owner) {
    const { data } = await supabase.from("profiles").select("full_name").eq("id", owner).single();
    ownerName = data?.full_name ?? "";
  }

  const rows = await fetchAll<Row>((f, t) => {
    let q = supabase
      .from("policies")
      .select(
        "id, net_premium, closed_date, coverage_end_date, insurance_company, renewal_outcome, category:policy_categories(name), customer:customers!inner(id, name, owner_id)",
      )
      .eq("deal_status", "win")
      .order("closed_date", { ascending: false })
      .range(f, t);
    if (category_id) q = q.eq("category_id", category_id);
    if (owner) q = q.eq("customer.owner_id", owner);
    if (from) q = q.gte("closed_date", from);
    if (to) q = q.lte("closed_date", to);
    return q as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;
  });

  const total = rows.reduce((s, r) => s + Number(r.net_premium ?? 0), 0);

  return (
    <div className="p-8">
      <Link href="/" className="mb-4 inline-block text-xs text-slate-500 hover:underline">
        ← กลับ Dashboard
      </Link>
      <h1 className="text-lg font-semibold text-slate-900">
        กรมธรรม์{categoryName ? ` ประเภท ${categoryName}` : ""}
      </h1>
      <p className="mb-6 text-xs text-slate-500">
        {rows.length} รายการ{ownerName ? ` · Sales: ${ownerName}` : ""}{from && to ? ` · ${from} ถึง ${to}` : ""} · รวมเบี้ย {baht(total)} บาท
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ลูกค้า</th>
              <th className="px-4 py-3">ประเภท</th>
              <th className="px-4 py-3">บริษัทประกัน</th>
              <th className="px-4 py-3">เบี้ยประกัน</th>
              <th className="px-4 py-3">วันปิดดีล</th>
              <th className="px-4 py-3">วันหมดอายุ</th>
              <th className="px-4 py-3">ต่ออายุ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/policies/${r.id}`} className="font-medium text-slate-900 hover:underline">
                    {r.customer?.name ?? "-"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{r.category?.name ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{r.insurance_company ?? "-"}</td>
                <td className="px-4 py-3 font-mono text-slate-600">{baht(Number(r.net_premium ?? 0))}</td>
                <td className="px-4 py-3 text-slate-600">{r.closed_date ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{r.coverage_end_date ?? "-"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{RENEWAL_LABEL[r.renewal_outcome] ?? "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  ไม่มีรายการในช่วงที่เลือก
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
