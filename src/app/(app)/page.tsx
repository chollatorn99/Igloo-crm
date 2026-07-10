import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetchAll";

type NoteRow = { author_id: string; created_at: string };
type DashPolicyRow = {
  deal_status: string;
  net_premium: number | null;
  company_commission_amount: number | null;
  closed_date: string | null;
  category: { name: string } | null;
  customer: { owner_id: string } | null;
};

type Stat = {
  calls: number;
  premium: number;
  commission: number;
  win: number;
  lost: number;
};

const PALETTE = [
  "#2563eb", "#16a34a", "#db2777", "#d97706", "#7c3aed",
  "#0891b2", "#dc2626", "#65a30d", "#c026d3", "#0d9488",
  "#ea580c", "#4f46e5", "#059669", "#e11d48", "#9333ea",
];

const blankStat = (): Stat => ({ calls: 0, premium: 0, commission: 0, win: 0, lost: 0 });
const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
const iso = (d: Date) => d.toISOString().slice(0, 10);

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

// Resolve the active reporting window from the query string. Default = the
// current calendar month, so "ยอดเดือนนี้" is what shows on first load.
function resolveRange(sp: { range?: string; from?: string; to?: string }) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const range = sp.range ?? "month";

  if (range === "all") return { from: null, to: null, label: "ทั้งหมด" };
  if (range === "year") return { from: `${y}-01-01`, to: `${y}-12-31`, label: `ปี ${y}` };
  if (range === "lastmonth") {
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 0);
    return { from: iso(from), to: iso(to), label: `${TH_MONTHS[from.getMonth()]} ${from.getFullYear()}` };
  }
  if (range === "custom" && sp.from && sp.to) {
    return { from: sp.from, to: sp.to, label: `${sp.from} ถึง ${sp.to}` };
  }
  // month (default)
  const from = new Date(y, m, 1);
  const to = new Date(y, m + 1, 0);
  return { from: iso(from), to: iso(to), label: `${TH_MONTHS[m]} ${y}` };
}

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const { from, to, label } = resolveRange(sp);
  const activeRange = sp.range ?? "month";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user!.id).single();
  const isManager = profile?.role === "manager";

  const [{ data: profiles }, notes, policies] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("role", ["sales", "manager"]).order("full_name"),
    fetchAll<NoteRow>((f, t) => {
      let q = supabase.from("follow_up_notes").select("author_id, created_at").order("created_at").range(f, t);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", `${to}T23:59:59`);
      return q as unknown as PromiseLike<{ data: NoteRow[] | null; error: { message: string } | null }>;
    }),
    fetchAll<DashPolicyRow>((f, t) => {
      let q = supabase
        .from("policies")
        .select(
          "deal_status, net_premium, company_commission_amount, closed_date, category:policy_categories(name), customer:customers(owner_id)",
        )
        .in("deal_status", ["win", "lost"])
        .order("closed_date")
        .range(f, t);
      // Filter by the sale/conclusion date (closed_date) for the window.
      if (from) q = q.gte("closed_date", from);
      if (to) q = q.lte("closed_date", to);
      return q as unknown as PromiseLike<{ data: DashPolicyRow[] | null; error: { message: string } | null }>;
    }),
  ]);

  const byUser = new Map<string, Stat>();
  const get = (id: string) => {
    if (!byUser.has(id)) byUser.set(id, blankStat());
    return byUser.get(id)!;
  };

  for (const n of notes) get(n.author_id).calls++;

  const byCategory = new Map<string, { count: number; premium: number; commission: number }>();
  for (const p of policies) {
    const ownerId = p.customer?.owner_id;
    if (!ownerId) continue;
    const s = get(ownerId);
    if (p.deal_status === "win") {
      s.win++;
      const premium = Number(p.net_premium ?? 0);
      const commission = Number(p.company_commission_amount ?? 0);
      s.premium += premium;
      s.commission += commission;
      const catName = p.category?.name ?? "ไม่ระบุ";
      const c = byCategory.get(catName) ?? { count: 0, premium: 0, commission: 0 };
      c.count++;
      c.premium += premium;
      c.commission += commission;
      byCategory.set(catName, c);
    } else if (p.deal_status === "lost") {
      s.lost++;
    }
  }

  const totals = [...byUser.values()].reduce((acc, s) => {
    (Object.keys(s) as (keyof Stat)[]).forEach((k) => (acc[k] = (acc[k] ?? 0) + s[k]));
    return acc;
  }, blankStat());

  const mine = get(user!.id);
  const scope = isManager ? totals : mine;
  const winRate = (s: Stat) => (s.win + s.lost === 0 ? 0 : Math.round((s.win / (s.win + s.lost)) * 100));

  const categories = [...byCategory.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.premium - a.premium);
  const maxCatPremium = Math.max(1, ...categories.map((c) => c.premium));
  const sortedNames = [...byCategory.keys()].sort();
  const colorFor = (name: string) => PALETTE[sortedNames.indexOf(name) % PALETTE.length];

  const presets = [
    { key: "month", label: "เดือนนี้" },
    { key: "lastmonth", label: "เดือนที่แล้ว" },
    { key: "year", label: "ปีนี้" },
    { key: "all", label: "ทั้งหมด" },
  ];

  const Card = ({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold ${accent ?? "text-slate-900"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );

  return (
    <div className="p-8">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">Performance Dashboard</h1>
        <p className="text-xs text-slate-500">
          สวัสดี {profile?.full_name} · {isManager ? "ภาพรวมทั้งทีม" : "ผลงานของคุณ"} · ช่วง:{" "}
          <span className="font-medium text-slate-700">{label}</span>
        </p>
      </div>

      {/* Period selector */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {presets.map((p) => (
          <Link
            key={p.key}
            href={`/?range=${p.key}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              activeRange === p.key
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {p.label}
          </Link>
        ))}
        <form className="flex items-center gap-1" action="/">
          <input type="hidden" name="range" value="custom" />
          <input type="date" name="from" defaultValue={sp.from ?? from ?? ""} className="rounded-md border border-slate-300 px-2 py-1 text-xs" />
          <span className="text-xs text-slate-400">ถึง</span>
          <input type="date" name="to" defaultValue={sp.to ?? to ?? ""} className="rounded-md border border-slate-300 px-2 py-1 text-xs" />
          <button className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
            ดูช่วงนี้
          </button>
        </form>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="ค่าคอมบริษัท (รายได้ Igloo)" value={baht(scope.commission)} accent="text-emerald-700" />
        <Card label="เบี้ยประกันสุทธิ" value={baht(scope.premium)} />
        <Card label="โทรติดตาม" value={baht(scope.calls)} />
        <Card label="Win Rate" value={`${winRate(scope)}%`} sub={`Win ${scope.win} / Lost ${scope.lost}`} />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-slate-600">ประเภทกรมธรรม์ที่ขายได้ (ตามเบี้ยประกัน)</h2>
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
        {categories.length === 0 && <p className="text-sm text-slate-400">ไม่มียอดขายในช่วงที่เลือก</p>}
        <div className="space-y-2.5">
          {categories.map((c) => (
            <div key={c.name} className="flex items-center gap-3 text-sm">
              <div className="w-28 shrink-0 truncate text-slate-700" title={c.name}>{c.name}</div>
              <div className="flex-1">
                <div className="h-5 w-full overflow-hidden rounded bg-slate-100">
                  <div
                    className="h-full rounded"
                    style={{ width: `${(c.premium / maxCatPremium) * 100}%`, backgroundColor: colorFor(c.name) }}
                  />
                </div>
              </div>
              <div className="w-32 shrink-0 text-right font-mono text-xs text-slate-600">{baht(c.premium)} ฿</div>
              <div className="w-24 shrink-0 text-right font-mono text-xs text-slate-400">คอม {baht(c.commission)}</div>
              <div className="w-14 shrink-0 text-right text-xs text-slate-400">{c.count} ราย</div>
            </div>
          ))}
        </div>
      </div>

      {isManager && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-slate-600">แยกรายพนักงาน ({label})</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">พนักงาน</th>
                  <th className="px-4 py-3">โทรติดตาม</th>
                  <th className="px-4 py-3">เบี้ยสุทธิ</th>
                  <th className="px-4 py-3">ค่าคอมบริษัท</th>
                  <th className="px-4 py-3">Win</th>
                  <th className="px-4 py-3">Lost</th>
                  <th className="px-4 py-3">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(profiles ?? []).map((p) => {
                  const s = byUser.get(p.id) ?? blankStat();
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{p.full_name}</td>
                      <td className="px-4 py-3">{s.calls}</td>
                      <td className="px-4 py-3 font-mono">{baht(s.premium)}</td>
                      <td className="px-4 py-3 font-mono text-emerald-700">{baht(s.commission)}</td>
                      <td className="px-4 py-3">{s.win}</td>
                      <td className="px-4 py-3">{s.lost}</td>
                      <td className="px-4 py-3">{winRate(s)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">* ค่าคอมมิชชั่นของ sales จะเพิ่มให้เมื่อได้เงื่อนไขการคำนวณ</p>
        </>
      )}
    </div>
  );
}
