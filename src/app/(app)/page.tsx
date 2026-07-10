import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetchAll";

type NoteRow = { author_id: string; created_at: string };
type DashPolicyRow = {
  deal_status: string;
  renewal_outcome: string;
  net_premium: number | null;
  company_commission_amount: number | null;
  closed_date: string | null;
  category: { name: string } | null;
  customer: { owner_id: string } | null;
};

type Stat = {
  calls_today: number;
  calls_7d: number;
  calls_30d: number;
  premium_all: number;
  commission_all: number;
  premium_30d: number;
  commission_30d: number;
  win: number;
  lost: number;
  not_renewed: number;
};

// Distinct, reasonably accessible categorical palette for the policy-type
// breakdown. Assigned by sorted category name so a type keeps its colour.
const PALETTE = [
  "#2563eb", "#16a34a", "#db2777", "#d97706", "#7c3aed",
  "#0891b2", "#dc2626", "#65a30d", "#c026d3", "#0d9488",
  "#ea580c", "#4f46e5", "#059669", "#e11d48", "#9333ea",
];

function startOfDaysAgo(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

const blankStat = (): Stat => ({
  calls_today: 0, calls_7d: 0, calls_30d: 0,
  premium_all: 0, commission_all: 0, premium_30d: 0, commission_30d: 0,
  win: 0, lost: 0, not_renewed: 0,
});

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

export default async function DashboardHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user!.id).single();
  const isManager = profile?.role === "manager";

  const [{ data: profiles }, notes, policies] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("role", ["sales", "manager"]).order("full_name"),
    fetchAll<NoteRow>((from, to) =>
      supabase
        .from("follow_up_notes")
        .select("author_id, created_at")
        .order("created_at")
        .range(from, to) as unknown as PromiseLike<{ data: NoteRow[] | null; error: { message: string } | null }>,
    ),
    fetchAll<DashPolicyRow>((from, to) =>
      supabase
        .from("policies")
        .select(
          "deal_status, renewal_outcome, net_premium, company_commission_amount, closed_date, category:policy_categories(name), customer:customers(owner_id)",
        )
        .order("created_at")
        .range(from, to) as unknown as PromiseLike<{ data: DashPolicyRow[] | null; error: { message: string } | null }>,
    ),
  ]);

  const today = startOfDaysAgo(0);
  const d7 = startOfDaysAgo(7);
  const d30 = startOfDaysAgo(30);

  const byUser = new Map<string, Stat>();
  const get = (id: string) => {
    if (!byUser.has(id)) byUser.set(id, blankStat());
    return byUser.get(id)!;
  };

  for (const n of notes) {
    const created = new Date(n.created_at);
    const s = get(n.author_id);
    if (created >= today) s.calls_today++;
    if (created >= d7) s.calls_7d++;
    if (created >= d30) s.calls_30d++;
  }

  // Category totals (won policies only). Split per-owner for manager's
  // per-person view is out of scope here — this is the whole visible scope.
  const byCategory = new Map<string, { count: number; premium: number; commission: number }>();

  for (const p of policies) {
    const ownerId = p.customer?.owner_id;
    if (!ownerId) continue;
    const s = get(ownerId);

    if (p.deal_status === "win") {
      s.win++;
      if (p.renewal_outcome === "not_renewed") s.not_renewed++;
      const premium = Number(p.net_premium ?? 0);
      const commission = Number(p.company_commission_amount ?? 0);
      s.premium_all += premium;
      s.commission_all += commission;
      const closed = p.closed_date ? new Date(p.closed_date) : null;
      if (closed && closed >= d30) {
        s.premium_30d += premium;
        s.commission_30d += commission;
      }
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
  const colorFor = (name: string) => {
    const idx = [...byCategory.keys()].sort().indexOf(name);
    return PALETTE[idx % PALETTE.length];
  };

  const Card = ({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold ${accent ?? "text-slate-900"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-900">Performance Dashboard</h1>
        <p className="text-xs text-slate-500">
          สวัสดี {profile?.full_name} · {isManager ? "ภาพรวมทั้งทีม" : "ผลงานของคุณ"}
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card
          label="ค่าคอมบริษัทรวม (รายได้ Igloo)"
          value={baht(scope.commission_all)}
          sub={`30 วันล่าสุด: ${baht(scope.commission_30d)}`}
          accent="text-emerald-700"
        />
        <Card
          label="เบี้ยประกันสุทธิรวม"
          value={baht(scope.premium_all)}
          sub={`30 วันล่าสุด: ${baht(scope.premium_30d)}`}
        />
        <Card label="โทรติดตาม (30 วัน)" value={baht(scope.calls_30d)} sub={`วันนี้: ${scope.calls_today}`} />
        <Card label="Win Rate" value={`${winRate(scope)}%`} sub={`Win ${scope.win} / Lost ${scope.lost}`} />
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3">
        <Card label="ดีลปิดได้ (Win)" value={baht(scope.win)} accent="text-emerald-700" />
        <Card label="ดีลไม่ปิด (Lost)" value={baht(scope.lost)} accent="text-rose-600" />
        <Card label="ไม่ต่ออายุ" value={baht(scope.not_renewed)} accent="text-amber-600" />
      </div>

      {/* Policy type breakdown with colour */}
      <h2 className="mb-3 text-sm font-semibold text-slate-600">ประเภทกรมธรรม์ที่ขายได้ (ตามเบี้ยประกัน)</h2>
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
        {categories.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p>}
        <div className="space-y-2.5">
          {categories.map((c) => (
            <div key={c.name} className="flex items-center gap-3 text-sm">
              <div className="w-28 shrink-0 truncate text-slate-700" title={c.name}>
                {c.name}
              </div>
              <div className="flex-1">
                <div className="h-5 w-full overflow-hidden rounded bg-slate-100">
                  <div
                    className="h-full rounded"
                    style={{ width: `${(c.premium / maxCatPremium) * 100}%`, backgroundColor: colorFor(c.name) }}
                  />
                </div>
              </div>
              <div className="w-32 shrink-0 text-right font-mono text-xs text-slate-600">{baht(c.premium)} ฿</div>
              <div className="w-24 shrink-0 text-right font-mono text-xs text-slate-400">
                คอม {baht(c.commission)}
              </div>
              <div className="w-14 shrink-0 text-right text-xs text-slate-400">{c.count} ราย</div>
            </div>
          ))}
        </div>
      </div>

      {isManager && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-slate-600">แยกรายพนักงาน</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">พนักงาน</th>
                  <th className="px-4 py-3">โทร 30 วัน</th>
                  <th className="px-4 py-3">เบี้ยสุทธิรวม</th>
                  <th className="px-4 py-3">ค่าคอมบริษัท</th>
                  <th className="px-4 py-3">Win</th>
                  <th className="px-4 py-3">Lost</th>
                  <th className="px-4 py-3">ไม่ต่อ</th>
                  <th className="px-4 py-3">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(profiles ?? []).map((p) => {
                  const s = byUser.get(p.id) ?? blankStat();
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{p.full_name}</td>
                      <td className="px-4 py-3">{s.calls_30d}</td>
                      <td className="px-4 py-3 font-mono">{baht(s.premium_all)}</td>
                      <td className="px-4 py-3 font-mono text-emerald-700">{baht(s.commission_all)}</td>
                      <td className="px-4 py-3">{s.win}</td>
                      <td className="px-4 py-3">{s.lost}</td>
                      <td className="px-4 py-3">{s.not_renewed}</td>
                      <td className="px-4 py-3">{winRate(s)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            * ค่าคอมมิชชั่นของ sales จะเพิ่มให้เมื่อได้เงื่อนไขการคำนวณ
          </p>
        </>
      )}
    </div>
  );
}
