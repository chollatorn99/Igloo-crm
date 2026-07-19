import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetchAll";

type PolicyRow = {
  id: string;
  coverage_end_date: string;
  insurance_company: string | null;
  category: { name: string; renewal_reminder_days: number } | null;
  customer: { id: string; name: string; phone: string | null; owner_id: string; owner: { full_name: string } | null } | null;
};

// How far past expiry a policy still counts as "urgent follow-up" rather
// than a lost/win-back case (those live on the history page).
const OVERDUE_GRACE_DAYS = 30;

export default async function RenewalsPage({
  searchParams,
}: {
  searchParams: Promise<{ sales?: string }>;
}) {
  const { sales } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  const isManager = me?.role === "manager";
  // Only the manager sees the whole team, so only they get the salesperson picker.
  const people = isManager
    ? (await supabase.from("profiles").select("id, full_name").in("role", ["sales", "manager"]).order("full_name")).data
    : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const floor = new Date(today.getTime() - OVERDUE_GRACE_DAYS * 86400e3).toISOString().slice(0, 10);

  const policies = await fetchAll<PolicyRow>((from, to) => {
    let q = supabase
      .from("policies")
      .select(
        "id, coverage_end_date, insurance_company, category:policy_categories(name, renewal_reminder_days), customer:customers!inner(id, name, phone, owner_id, owner:profiles(full_name))",
      )
      .eq("deal_status", "win")
      // Only still-open follow-ups: once sales marks the outcome (ต่อแล้ว /
      // ไม่ต่อ) the policy drops off this list.
      .eq("renewal_outcome", "pending")
      .gte("coverage_end_date", floor)
      .order("coverage_end_date", { ascending: true })
      .range(from, to);
    if (isManager && sales) q = q.eq("customer.owner_id", sales);
    return q as unknown as PromiseLike<{ data: PolicyRow[] | null; error: { message: string } | null }>;
  });

  // One reminder per customer+category, based on their newest policy — an
  // already-renewed customer's newest end date falls outside the reminder
  // window, so they drop off the list automatically.
  const latestByGroup = new Map<string, PolicyRow>();
  for (const p of policies) {
    if (!p.customer || !p.category) continue;
    const key = `${p.customer.id}|${p.category.name}`;
    const current = latestByGroup.get(key);
    if (!current || p.coverage_end_date > current.coverage_end_date) {
      latestByGroup.set(key, p);
    }
  }

  const due = [...latestByGroup.values()]
    .map((p) => {
      const endDate = new Date(p.coverage_end_date);
      const daysLeft = Math.round((endDate.getTime() - today.getTime()) / 86400e3);
      return { ...p, daysLeft };
    })
    .filter((p) => p.daysLeft <= (p.category?.renewal_reminder_days ?? 120))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const selectedName = sales ? people?.find((x) => x.id === sales)?.full_name : null;

  return (
    <div className="p-8">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">แจ้งเตือนต่ออายุ</h1>
      <p className="mb-4 text-xs text-slate-500">
        {due.length} รายการ{selectedName ? ` · เฉพาะของ ${selectedName}` : ""} — กรมธรรม์ล่าสุดของลูกค้าแต่ละราย/ประเภท ที่ใกล้หมดอายุ
        (รวมที่เพิ่งเกินกำหนดไม่เกิน {OVERDUE_GRACE_DAYS} วัน) — ลูกค้าที่ขาดต่อนานแล้วอยู่ในหน้า &quot;ประวัติลูกค้าเก่า&quot;
      </p>

      {isManager && (
        <form className="mb-4 flex flex-wrap gap-2">
          <select name="sales" defaultValue={sales ?? ""} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">ทุก Sales</option>
            {people?.map((x) => (
              <option key={x.id} value={x.id}>
                {x.full_name}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            กรอง
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ลูกค้า</th>
              <th className="px-4 py-3">เบอร์โทร</th>
              {isManager && <th className="px-4 py-3">Sales</th>}
              <th className="px-4 py-3">ประเภท</th>
              <th className="px-4 py-3">บริษัทประกัน</th>
              <th className="px-4 py-3">วันหมดอายุ</th>
              <th className="px-4 py-3">เหลือ (วัน)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {due.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  {/* Link to this exact policy — that's the one the reminder
                      is about and where ต่อแล้ว/ไม่ต่อ gets recorded. */}
                  <Link href={`/policies/${p.id}`} className="font-medium text-slate-900 hover:underline">
                    {p.customer!.name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.customer!.phone ?? "-"}</td>
                {isManager && <td className="px-4 py-3 text-slate-600">{p.customer!.owner?.full_name ?? "-"}</td>}
                <td className="px-4 py-3 text-slate-600">{p.category?.name}</td>
                <td className="px-4 py-3 text-slate-600">{p.insurance_company ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{p.coverage_end_date}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      p.daysLeft < 0
                        ? "bg-rose-100 text-rose-700"
                        : p.daysLeft <= 14
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {p.daysLeft < 0 ? `เกิน ${Math.abs(p.daysLeft)} วัน` : `${p.daysLeft} วัน`}
                  </span>
                </td>
              </tr>
            ))}
            {due.length === 0 && (
              <tr>
                <td colSpan={isManager ? 7 : 6} className="px-4 py-10 text-center text-slate-400">
                  ไม่มีกรมธรรม์ใกล้หมดอายุ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
