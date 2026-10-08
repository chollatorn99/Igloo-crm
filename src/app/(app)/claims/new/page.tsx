import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewClaimForm } from "./form";

export default async function NewClaimPage({ searchParams }: { searchParams: Promise<{ customer?: string; q?: string }> }) {
  const { customer, q } = await searchParams;
  const supabase = await createClient();

  // No customer chosen yet → search & pick one right here.
  if (!customer) {
    let results: { id: string; name: string; phone: string | null }[] = [];
    const info = new Map<string, { cats: Set<string>; latestStart: string | null; latestEnd: string | null }>();
    if (q?.trim()) {
      const term = q.trim().replace(/[%,()]/g, "");
      const { data } = await supabase
        .from("customers")
        .select("id, name, phone")
        .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
        .limit(25);
      results = data ?? [];
      // Enrich with each customer's policy types + current coverage year, so
      // staff can tell near-identical company names apart.
      if (results.length) {
        const { data: pols } = await supabase
          .from("policies")
          .select("customer_id, coverage_start_date, coverage_end_date, category:policy_categories(name)")
          .in("customer_id", results.map((r) => r.id))
          .eq("deal_status", "win");
        for (const p of (pols ?? []) as unknown as { customer_id: string; coverage_start_date: string | null; coverage_end_date: string | null; category: { name: string } | null }[]) {
          const g = info.get(p.customer_id) ?? { cats: new Set<string>(), latestStart: null, latestEnd: null };
          if (p.category?.name) g.cats.add(p.category.name);
          if (p.coverage_end_date && (!g.latestEnd || p.coverage_end_date > g.latestEnd)) { g.latestEnd = p.coverage_end_date; g.latestStart = p.coverage_start_date; }
          info.set(p.customer_id, g);
        }
      }
    }
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Link href="/claims" className="mb-4 inline-block text-xs text-slate-500 hover:underline">← กลับรายการเคลม</Link>
        <h1 className="mb-3 text-lg font-semibold text-slate-900">แจ้งเคลมใหม่ — เลือกลูกค้า</h1>
        <form className="mb-4 flex gap-2">
          <input name="q" defaultValue={q ?? ""} placeholder="ค้นหาชื่อ / เบอร์โทรลูกค้า" className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500" autoFocus />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">ค้นหา</button>
        </form>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {results.map((c) => {
            const g = info.get(c.id);
            const cats = g && g.cats.size ? [...g.cats].join(", ") : "ยังไม่มีกรมธรรม์";
            const year = g?.latestStart ? g.latestStart.slice(0, 4) : null;
            return (
              <Link key={c.id} href={`/claims/new?customer=${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500">
                    {cats}
                    {g?.latestEnd ? ` · คุ้มครองล่าสุด ${g.latestStart ?? "?"} – ${g.latestEnd}${year ? ` (ปี ${year})` : ""}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-slate-500">{c.phone ?? "-"} · เลือก →</span>
              </Link>
            );
          })}
          {q && results.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">ไม่พบลูกค้า</p>}
          {!q && <p className="px-4 py-6 text-center text-sm text-slate-400">พิมพ์ชื่อ/เบอร์เพื่อค้นหาลูกค้า แล้วเลือกเพื่อแจ้งเคลม</p>}
        </div>
      </div>
    );
  }

  const { data: cust } = await supabase.from("customers").select("name").eq("id", customer).single();
  const { data: pols } = await supabase
    .from("policies")
    .select("id, policy_detail, category:policy_categories(name), insurance_company")
    .eq("customer_id", customer)
    .order("created_at", { ascending: false });
  const policies = (pols ?? []).map((p) => ({
    id: p.id,
    label: [(p.category as unknown as { name: string } | null)?.name, p.insurance_company, p.policy_detail].filter(Boolean).join(" · ") || "กรมธรรม์",
  }));

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link href={`/customers/${customer}`} className="mb-4 inline-block text-xs text-slate-500 hover:underline">← กลับหน้าลูกค้า</Link>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">แจ้งเคลมใหม่</h1>
      <NewClaimForm customerId={customer} customerName={cust?.name ?? "-"} policies={policies} />
    </div>
  );
}
