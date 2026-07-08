import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExportButton } from "./export-button";

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "รอลูกค้าชำระ",
  awaiting_verification: "รอบัญชีตรวจสอบ",
  verified: "ตรวจสอบแล้ว",
  rejected: "สลิปไม่ผ่าน",
};

export default async function PaymentsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("policies")
    .select(
      "id, payment_status, payment_reference, payment_date, net_premium, company_commission_amount, agent_commission_amount, net_commission_to_igloo, closed_date, category:policy_categories(name), customer:customers(id, name)",
    )
    .eq("deal_status", "win")
    .order("closed_date", { ascending: false });

  if (status) query = query.eq("payment_status", status);

  const { data: policies } = await query;

  const tabs = [
    { key: "", label: "ทั้งหมด" },
    { key: "awaiting_payment", label: "รอลูกค้าชำระ" },
    { key: "awaiting_verification", label: "รอบัญชีตรวจสอบ" },
    { key: "verified", label: "ตรวจสอบแล้ว" },
    { key: "rejected", label: "สลิปไม่ผ่าน" },
  ];

  const exportRows = (policies ?? []).map((p) => ({
    ลูกค้า: (p.customer as { name: string } | null)?.name,
    ประเภท: (p.category as { name: string } | null)?.name,
    เบี้ยประกัน: p.net_premium,
    ค่าคอมบริษัท: p.company_commission_amount,
    ค่าคอมAgent: p.agent_commission_amount,
    ค่าคอมสุทธิ: p.net_commission_to_igloo,
    สถานะการชำระ: PAYMENT_STATUS_LABEL[p.payment_status as string] ?? "",
    เลขอ้างอิง: p.payment_reference,
    วันที่โอน: p.payment_date,
    วันที่ปิดดีล: p.closed_date,
  }));

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">คิวตรวจสอบการชำระเงิน</h1>
          <p className="text-xs text-slate-500">{policies?.length ?? 0} รายการ</p>
        </div>
        <ExportButton rows={exportRows} filename="payment-queue" />
      </div>

      <div className="mb-4 flex gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key ? `/payments?status=${t.key}` : "/payments"}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              (status ?? "") === t.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ลูกค้า</th>
              <th className="px-4 py-3">ประเภท</th>
              <th className="px-4 py-3">เบี้ยประกัน</th>
              <th className="px-4 py-3">ค่าคอมสุทธิ</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">เลขอ้างอิง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {policies?.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/policies/${p.id}`} className="font-medium text-slate-900 hover:underline">
                    {(p.customer as { name: string } | null)?.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{(p.category as { name: string } | null)?.name}</td>
                <td className="px-4 py-3 font-mono text-slate-600">
                  {Number(p.net_premium ?? 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono text-slate-600">
                  {Number(p.net_commission_to_igloo ?? 0).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      p.payment_status === "verified"
                        ? "bg-emerald-100 text-emerald-700"
                        : p.payment_status === "rejected"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {PAYMENT_STATUS_LABEL[p.payment_status as string] ?? "-"}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.payment_reference ?? "-"}</td>
              </tr>
            ))}
            {policies?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  ไม่มีรายการ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
