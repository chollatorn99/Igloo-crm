import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InstallmentCard, type InstallmentRow } from "./installments-list";

type PolicyRow = {
  id: string;
  installment_months: number | null;
  installment_amount: number | null;
  installment_with: string | null;
  installment_interest_rate: number | null;
  net_premium: number | null;
  total_premium: number | null;
  category: { name: string } | null;
  customer: { id: string; name: string } | null;
};

const WITH_LABEL: Record<string, string> = { igloo: "อิกลู โบรคเกอร์", insurer: "บริษัทประกัน" };

const baht = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });

export default async function InstallmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();

  // Installment policies the viewer can see (RLS scopes owner/manager/
  // accounting/support).
  const { data: policies } = await supabase
    .from("policies")
    .select("id, installment_months, installment_amount, installment_with, installment_interest_rate, net_premium, total_premium, category:policy_categories(name), customer:customers(id, name)")
    .eq("is_installment", true)
    .eq("deal_status", "win")
    .order("closed_date", { ascending: false });

  const pols = (policies ?? []) as unknown as PolicyRow[];
  const ids = pols.map((p) => p.id);

  let schedule: InstallmentRow[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from("installment_payments")
      .select("id, policy_id, installment_no, due_date, amount, paid, paid_date, note")
      .in("policy_id", ids)
      .order("installment_no");
    schedule = (data ?? []) as InstallmentRow[];
  }

  const byPolicy = new Map<string, InstallmentRow[]>();
  for (const r of schedule) {
    const arr = byPolicy.get(r.policy_id) ?? [];
    arr.push(r);
    byPolicy.set(r.policy_id, arr);
  }

  // Build display cards with progress; filter + sort by nearest unpaid due.
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const cards = pols.map((p) => {
    const rows = byPolicy.get(p.id) ?? [];
    const paidCount = rows.filter((r) => r.paid).length;
    const paidAmount = rows.filter((r) => r.paid).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const planAmount = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const remaining = planAmount - paidAmount;
    const nextUnpaid = rows.filter((r) => !r.paid && r.due_date).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0];
    const overdue = rows.some((r) => !r.paid && r.due_date && r.due_date < today);
    const done = rows.length > 0 && paidCount === rows.length;
    return { p, rows, paidCount, paidAmount, planAmount, remaining, nextUnpaid, overdue, done };
  });

  const filtered = cards.filter((c) => {
    if (status === "active") return !c.done;
    if (status === "done") return c.done;
    if (status === "overdue") return c.overdue;
    return true;
  });
  filtered.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1; // active first
    const ad = a.nextUnpaid?.due_date ?? "9999";
    const bd = b.nextUnpaid?.due_date ?? "9999";
    return ad < bd ? -1 : 1;
  });

  const totalRemaining = cards.filter((c) => !c.done).reduce((s, c) => s + c.remaining, 0);
  const overdueCount = cards.filter((c) => c.overdue).length;

  // Program summary report.
  const zeroPct = cards.filter((c) => Number(c.p.installment_interest_rate ?? 0) === 0).length;
  const withInterest = cards.length - zeroPct;
  const withIgloo = cards.filter((c) => c.p.installment_with === "igloo").length;
  const withInsurer = cards.filter((c) => c.p.installment_with === "insurer").length;
  // Per-installment payment timeliness across every scheduled row.
  let onTime = 0, late = 0, overdueUnpaid = 0, upcoming = 0;
  for (const c of cards) for (const r of c.rows) {
    if (r.paid) { if (r.paid_date && r.due_date && r.paid_date > r.due_date) late++; else onTime++; }
    else if (r.due_date && r.due_date < today) overdueUnpaid++;
    else upcoming++;
  }

  const tabs = [
    { key: "", label: "ทั้งหมด" },
    { key: "active", label: "ยังผ่อนอยู่" },
    { key: "overdue", label: "เลยกำหนด" },
    { key: "done", label: "ผ่อนครบแล้ว" },
  ];

  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-slate-900">ติดตามการผ่อนชำระ</h1>
      <p className="mb-4 text-xs text-slate-500">
        {cards.length} กรมธรรม์ที่ผ่อนชำระ · ยอดคงเหลือรวม {baht(totalRemaining)} บาท
        {overdueCount > 0 && <span className="text-rose-600"> · เลยกำหนด {overdueCount} ราย</span>}
      </p>

      {/* สรุปรายงานโปรแกรมผ่อนชำระ */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] text-slate-500">เข้าโปรแกรมผ่อน</p>
          <p className="text-lg font-semibold text-slate-900">{cards.length} <span className="text-xs font-normal text-slate-400">ราย</span></p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] text-slate-500">ผ่อน 0% / มีดอกเบี้ย</p>
          <p className="text-lg font-semibold text-slate-900">{zeroPct} <span className="text-xs font-normal text-slate-400">/ {withInterest}</span></p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] text-slate-500">ผ่อนกับอิกลู / บ.ประกัน</p>
          <p className="text-lg font-semibold text-slate-900">{withIgloo} <span className="text-xs font-normal text-slate-400">/ {withInsurer}</span></p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[11px] text-emerald-700">งวดจ่ายตรงเวลา</p>
          <p className="text-lg font-semibold text-emerald-700">{onTime}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[11px] text-amber-700">งวดจ่ายช้า</p>
          <p className="text-lg font-semibold text-amber-700">{late}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-[11px] text-rose-700">งวดค้างชำระ (เลย due)</p>
          <p className="text-lg font-semibold text-rose-700">{overdueUnpaid}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key ? `/installments?status=${t.key}` : "/installments"}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              (status ?? "") === t.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((c) => (
          <InstallmentCard
            key={c.p.id}
            policyId={c.p.id}
            customerName={c.p.customer?.name ?? "-"}
            categoryName={c.p.category?.name ?? "-"}
            withWhom={c.p.installment_with ? WITH_LABEL[c.p.installment_with] ?? c.p.installment_with : null}
            interestRate={c.p.installment_interest_rate ?? 0}
            planMonths={c.p.installment_months}
            planAmount={c.p.installment_amount}
            paidCount={c.paidCount}
            totalCount={c.rows.length}
            paidAmount={c.paidAmount}
            remaining={c.remaining}
            overdue={c.overdue}
            done={c.done}
            rows={c.rows}
          />
        ))}
        {filtered.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">ไม่มีรายการผ่อนชำระในหมวดนี้</p>
        )}
      </div>
    </div>
  );
}
