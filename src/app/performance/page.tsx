import { createClient } from "@/lib/supabase/server";

function startOfDaysAgo(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

export default async function PerformancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user!.id).single();
  const isManager = profile?.role === "manager";

  const [{ data: profiles }, { data: notes }, { data: policies }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("role", ["sales", "manager"]),
    supabase.from("follow_up_notes").select("author_id, created_at"),
    supabase
      .from("policies")
      .select("deal_status, net_premium, closed_date, customer:customers(owner_id)")
      .in("deal_status", ["win", "lost"]),
  ]);

  const today = startOfDaysAgo(0);
  const d7 = startOfDaysAgo(7);
  const d30 = startOfDaysAgo(30);

  type Stat = { calls_today: number; calls_7d: number; calls_30d: number; rev_today: number; rev_7d: number; rev_30d: number; win: number; lost: number };
  const byUser = new Map<string, Stat>();
  const blank = (): Stat => ({ calls_today: 0, calls_7d: 0, calls_30d: 0, rev_today: 0, rev_7d: 0, rev_30d: 0, win: 0, lost: 0 });
  const get = (id: string) => {
    if (!byUser.has(id)) byUser.set(id, blank());
    return byUser.get(id)!;
  };

  for (const n of notes ?? []) {
    const created = new Date(n.created_at);
    const s = get(n.author_id);
    if (created >= today) s.calls_today++;
    if (created >= d7) s.calls_7d++;
    if (created >= d30) s.calls_30d++;
  }

  for (const p of policies ?? []) {
    const ownerId = (p.customer as { owner_id: string } | null)?.owner_id;
    if (!ownerId) continue;
    const s = get(ownerId);
    if (p.deal_status === "win") {
      s.win++;
      const closed = p.closed_date ? new Date(p.closed_date) : null;
      const premium = Number(p.net_premium ?? 0);
      if (closed && closed >= today) s.rev_today += premium;
      if (closed && closed >= d7) s.rev_7d += premium;
      if (closed && closed >= d30) s.rev_30d += premium;
    } else if (p.deal_status === "lost") {
      s.lost++;
    }
  }

  const team = [...byUser.values()].reduce((acc, s) => {
    (Object.keys(s) as (keyof Stat)[]).forEach((k) => (acc[k] = (acc[k] ?? 0) + s[k]));
    return acc;
  }, {} as Stat);

  const myStat = get(user!.id);
  const winRate = (s: Stat) => (s.win + s.lost === 0 ? 0 : Math.round((s.win / (s.win + s.lost)) * 100));

  const StatCard = ({ label, value }: { label: string; value: string | number }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );

  return (
    <div className="p-8">
      <h1 className="mb-6 text-lg font-semibold text-slate-900">Performance Dashboard</h1>

      <h2 className="mb-2 text-sm font-semibold text-slate-600">
        {isManager ? "รวมทั้งทีม" : "ของฉัน"}
      </h2>
      <div className="mb-8 grid grid-cols-4 gap-3">
        <StatCard label="โทรวันนี้" value={(isManager ? team : myStat).calls_today} />
        <StatCard label="โทร 7 วัน" value={(isManager ? team : myStat).calls_7d} />
        <StatCard label="Revenue 30 วัน" value={(isManager ? team : myStat).rev_30d.toLocaleString()} />
        <StatCard label="Win Rate" value={`${winRate(isManager ? team : myStat)}%`} />
      </div>

      {isManager && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-slate-600">แยกรายคน</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">พนักงาน</th>
                  <th className="px-4 py-3">โทรวันนี้</th>
                  <th className="px-4 py-3">โทร 7 วัน</th>
                  <th className="px-4 py-3">โทร 30 วัน</th>
                  <th className="px-4 py-3">Revenue วันนี้</th>
                  <th className="px-4 py-3">Revenue 7 วัน</th>
                  <th className="px-4 py-3">Revenue 30 วัน</th>
                  <th className="px-4 py-3">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(profiles ?? []).map((p) => {
                  const s = byUser.get(p.id) ?? blank();
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{p.full_name}</td>
                      <td className="px-4 py-3">{s.calls_today}</td>
                      <td className="px-4 py-3">{s.calls_7d}</td>
                      <td className="px-4 py-3">{s.calls_30d}</td>
                      <td className="px-4 py-3 font-mono">{s.rev_today.toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono">{s.rev_7d.toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono">{s.rev_30d.toLocaleString()}</td>
                      <td className="px-4 py-3">{winRate(s)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
