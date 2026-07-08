import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function RenewalsPage() {
  const supabase = await createClient();

  const { data: policies } = await supabase
    .from("policies")
    .select(
      "id, coverage_end_date, insurance_company, category:policy_categories(name, renewal_reminder_days), customer:customers(id, name, phone, owner_id)",
    )
    .eq("deal_status", "win")
    .not("coverage_end_date", "is", null)
    .order("coverage_end_date", { ascending: true });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = (policies ?? [])
    .map((p) => {
      const category = p.category as { name: string; renewal_reminder_days: number } | null;
      const endDate = new Date(p.coverage_end_date as string);
      const daysLeft = Math.round((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...p, category, daysLeft };
    })
    .filter((p) => p.category && p.daysLeft <= p.category.renewal_reminder_days);

  return (
    <div className="p-8">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">แจ้งเตือนต่ออายุ</h1>
      <p className="mb-6 text-xs text-slate-500">
        {due.length} รายการ — เรียงจากใกล้หมดอายุที่สุด (เกณฑ์วันแจ้งเตือนต่างกันตามประเภทกรมธรรม์)
      </p>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ลูกค้า</th>
              <th className="px-4 py-3">เบอร์โทร</th>
              <th className="px-4 py-3">ประเภท</th>
              <th className="px-4 py-3">บริษัทประกัน</th>
              <th className="px-4 py-3">วันหมดอายุ</th>
              <th className="px-4 py-3">เหลือ (วัน)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {due.map((p) => {
              const customer = p.customer as { id: string; name: string; phone: string | null };
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${customer.id}`} className="font-medium text-slate-900 hover:underline">
                      {customer.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{customer.phone ?? "-"}</td>
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
              );
            })}
            {due.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
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
