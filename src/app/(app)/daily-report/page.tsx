import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetchAll";
import { DailyReport } from "./daily-report";

type Row = {
  net_premium: number | null;
  closed_date: string | null;
  policy_detail: string | null;
  renewed_from_policy_id: string | null;
  deal_status: string;
  category: { name: string } | null;
  customer: { owner_id: string } | null;
};

// BRG Motors report buckets (per the owner's mapping):
//  BRG    = imported cars: Alphard / Vellfire, Porsche, Mercedes-Benz
//  DEEPAL = Deepal (incl. Lumin)
//  then POCCO / KIA / CHERY; everything else = อื่นๆ.
function brandOf(detail: string | null): string {
  const s = (detail ?? "").toUpperCase();
  if (/ALPHARD|VELLFIRE|PORSCHE|MERCEDES|BENZ|\bMB\b|\bBRG\b/.test(s)) return "BRG";
  if (s.includes("DEEPAL") || s.includes("LUMIN")) return "DEEPAL";
  if (s.includes("POCCO")) return "POCCO";
  if (s.includes("KIA")) return "KIA";
  if (s.includes("CHERY")) return "CHERY";
  return "อื่นๆ";
}

const monthName = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric" });
};

export default async function DailyReportPage({ searchParams }: { searchParams: Promise<{ sales?: string; template?: string }> }) {
  const { sales, template } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role, full_name, supports_owner_id").eq("id", user!.id).single();
  const isManager = me?.role === "manager";
  const isSupport = me?.role === "support";
  // A support user has no policies of their own — they file the Daily Report
  // for the salesperson they assist, so scope the whole page to that person.
  const supportOwnerId = isSupport ? (me?.supports_owner_id ?? null) : null;

  const people = isManager
    ? (await supabase.from("profiles").select("id, full_name").in("role", ["sales", "manager"]).order("full_name")).data ?? []
    : [];
  const ownerId = isManager ? sales || user!.id : supportOwnerId ?? user!.id;
  let ownerName = me?.full_name ?? "";
  if (isManager) ownerName = people.find((p) => p.id === ownerId)?.full_name ?? me?.full_name ?? "";
  else if (isSupport && supportOwnerId) {
    const { data: sp } = await supabase.from("profiles").select("full_name").eq("id", supportOwnerId).single();
    ownerName = sp?.full_name ?? ownerName;
  }

  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const monthStart = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const lastYearStart = `${y - 1}-${String(m).padStart(2, "0")}-01`;
  const lastYearEnd = new Date(Date.UTC(y - 1, m, 0)).toISOString().slice(0, 10); // last day of that month

  const sel = "net_premium, closed_date, policy_detail, renewed_from_policy_id, deal_status, category:policy_categories(name), customer:customers!inner(owner_id)";
  const base = () =>
    supabase.from("policies").select(sel).eq("is_prospect", false).eq("is_intercompany", false).eq("customer.owner_id", ownerId);

  const mtdRows = await fetchAll<Row>((f, t) =>
    base().in("deal_status", ["win", "lost"]).gte("closed_date", monthStart).lte("closed_date", today).range(f, t) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  );
  const lastYearRows = await fetchAll<Row>((f, t) =>
    base().eq("deal_status", "win").gte("closed_date", lastYearStart).lte("closed_date", lastYearEnd).range(f, t) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  );

  const sum = (rows: Row[]) => rows.reduce((s, r) => s + Number(r.net_premium ?? 0), 0);
  const winMtd = mtdRows.filter((r) => r.deal_status === "win");
  const winToday = winMtd.filter((r) => r.closed_date === today);
  const lostMtd = mtdRows.filter((r) => r.deal_status === "lost");

  const brandSum = (rows: Row[]) => {
    const map = new Map<string, { units: number; premium: number }>();
    for (const r of rows) {
      const b = brandOf(r.policy_detail);
      if (!b) continue;
      const g = map.get(b) ?? { units: 0, premium: 0 };
      g.units++; g.premium += Number(r.net_premium ?? 0);
      map.set(b, g);
    }
    return map;
  };

  // Calls logged today (follow-up notes), excluding the dedup housekeeping note.
  const { count: callsLogged } = await supabase
    .from("follow_up_notes")
    .select("id", { count: "exact", head: true })
    .eq("author_id", ownerId)
    .not("note_text", "ilike", "[ยุบจากรายชื่อซ้ำ]%")
    .gte("created_at", `${today}T00:00:00`)
    .lte("created_at", `${today}T23:59:59`);

  const { data: target } = await supabase.from("report_targets").select("target_premium, existing_target").eq("owner_id", ownerId).eq("month", month).maybeSingle();
  const { data: entry } = await supabase.from("daily_report_entries").select("new_quotes, tbd, new_calls, follow_ups, no_response, wrong_number, note").eq("owner_id", ownerId).eq("report_date", today).maybeSingle();

  // Auto numbers handed to the client (which assembles + lets you copy the text).
  const data = {
    ownerId,
    ownerName,
    today: today.split("-").reverse().join("/"),
    monthLabel: monthName(month),
    lastYearMonthLabel: monthName(lastYearStart.slice(0, 7)),
    lastYearPremium: sum(lastYearRows),
    dailyPremium: sum(winToday),
    mtdPremium: sum(winMtd),
    newWin: winToday.filter((r) => !r.renewed_from_policy_id).length,
    renewalWin: winToday.filter((r) => r.renewed_from_policy_id).length,
    renewalWinByCat: Object.fromEntries(
      Object.entries(
        winToday.filter((r) => r.renewed_from_policy_id).reduce<Record<string, number>>((a, r) => { const k = r.category?.name ?? "อื่นๆ"; a[k] = (a[k] ?? 0) + 1; return a; }, {}),
      ),
    ),
    lostMtd: lostMtd.length,
    lostPremiumMtd: sum(lostMtd),
    brandsToday: [...brandSum(winToday).entries()].map(([b, g]) => ({ brand: b, ...g })),
    brandsMtd: [...brandSum(winMtd).entries()].map(([b, g]) => ({ brand: b, ...g })),
    brandsLastYear: [...brandSum(lastYearRows).entries()].map(([b, g]) => ({ brand: b, ...g })),
    callsLogged: callsLogged ?? 0,
    target: target ?? null,
    entry: entry ?? null,
    month,
  };

  const tpl = template === "motor" || template === "general" ? template : data.brandsMtd.length > 0 ? "motor" : "general";

  return (
    <div className="p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">Daily Report</h1>
        <div className="flex items-center gap-2 text-xs">
          {isManager && (
            <form action="/daily-report">
              <select name="sales" defaultValue={sales ?? user!.id} className="rounded-md border border-slate-300 px-2 py-1.5">
                {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
              {template && <input type="hidden" name="template" value={template} />}
              <button className="ml-1 rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white">ดู</button>
            </form>
          )}
          <Link href={`/daily-report?${sales ? `sales=${sales}&` : ""}template=general`} className={`rounded-full px-3 py-1.5 font-medium ${tpl === "general" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>ทั่วไป</Link>
          <Link href={`/daily-report?${sales ? `sales=${sales}&` : ""}template=motor`} className={`rounded-full px-3 py-1.5 font-medium ${tpl === "motor" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>BRG Motors</Link>
        </div>
      </div>
      <DailyReport data={data} template={tpl as "motor" | "general"} />
    </div>
  );
}
