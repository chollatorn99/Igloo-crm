import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExportButton } from "./export-button";
import { PaymentsTable, type PayRow } from "./payments-table";

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "รอลูกค้าชำระ",
  awaiting_verification: "รอบัญชีตรวจสอบ",
  verified: "ตรวจสอบแล้ว",
  rejected: "สลิปไม่ผ่าน",
};

export default async function PaymentsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string }>;
}) {
  const { status, from, to } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  const isManager = me?.role === "manager";
  const canExport = me?.role === "manager" || me?.role === "accounting";

  // Only deals actually in the payment workflow — imported historical wins
  // have payment_status null and would otherwise flood this queue. This
  // also keeps the result well under Supabase's 1000-row cap.
  let query = supabase
    .from("policies")
    .select(
      "id, payment_status, payment_reference, payment_date, amount_received, net_premium, total_premium, company_commission_amount, agent_commission_amount, net_commission_to_igloo, closed_date, category:policy_categories(name), customer:customers(id, name)",
    )
    .eq("deal_status", "win")
    .not("payment_status", "is", null)
    .order("closed_date", { ascending: false });

  if (status) query = query.eq("payment_status", status);
  if (from) query = query.gte("closed_date", from);
  if (to) query = query.lte("closed_date", to);

  const { data: policies } = await query;

  const tabs = [
    { key: "", label: "ทั้งหมด" },
    { key: "awaiting_payment", label: "รอลูกค้าชำระ" },
    { key: "awaiting_verification", label: "รอบัญชีตรวจสอบ" },
    { key: "verified", label: "ตรวจสอบแล้ว" },
    { key: "rejected", label: "สลิปไม่ผ่าน" },
  ];

  // Commission columns are company revenue — only managers get them, in the
  // table and in the export file.
  const exportRows = (policies ?? []).map((p) => ({
    ลูกค้า: (p.customer as unknown as { name: string } | null)?.name,
    ประเภท: (p.category as unknown as { name: string } | null)?.name,
    เบี้ยประกัน: p.net_premium,
    ...(isManager
      ? {
          ค่าคอมบริษัท: p.company_commission_amount,
          ค่าคอมAgent: p.agent_commission_amount,
          ค่าคอมสุทธิ: p.net_commission_to_igloo,
        }
      : {}),
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
        {canExport && (
          <ExportButton
            rows={exportRows}
            filename="payment-queue"
            exportType="payments"
            filterNote={status || undefined}
          />
        )}
      </div>

      <form className="mb-3 flex flex-wrap items-center gap-2" action="/payments">
        {status && <input type="hidden" name="status" value={status} />}
        <span className="text-xs text-slate-400">วันแจ้งงาน:</span>
        <input type="date" name="from" defaultValue={from ?? ""} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        <span className="text-xs text-slate-400">ถึง</span>
        <input type="date" name="to" defaultValue={to ?? ""} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        <button className="rounded-md bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800">กรอง</button>
        {(from || to) && (
          <Link href={status ? `/payments?status=${status}` : "/payments"} className="text-xs text-blue-600 hover:underline">
            ล้างช่วงวัน
          </Link>
        )}
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const qs = new URLSearchParams();
          if (t.key) qs.set("status", t.key);
          if (from) qs.set("from", from);
          if (to) qs.set("to", to);
          return (
            <Link
              key={t.key}
              href={`/payments${qs.toString() ? `?${qs.toString()}` : ""}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                (status ?? "") === t.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <p className="mb-3 text-xs text-slate-400">
        ติ๊กเลือกรายการสถานะ &quot;รอลูกค้าชำระ&quot; แล้วกด &quot;แจ้งชำระรวม&quot; เพื่อบันทึกการโอนครั้งเดียวสำหรับลูกค้าที่จ่ายหลายกรมธรรม์พร้อมกัน
      </p>

      <PaymentsTable
        isManager={isManager}
        rows={(policies ?? []).map((p): PayRow => ({
          id: p.id,
          customer_id: (p.customer as unknown as { id: string } | null)?.id ?? null,
          customer_name: (p.customer as unknown as { name: string } | null)?.name ?? null,
          category: (p.category as unknown as { name: string } | null)?.name ?? null,
          net_premium: p.net_premium as number | null,
          total_premium: (p as { total_premium?: number | null }).total_premium ?? null,
          net_commission_to_igloo: p.net_commission_to_igloo as number | null,
          payment_status: p.payment_status as string | null,
          payment_reference: p.payment_reference as string | null,
          payment_date: p.payment_date as string | null,
          amount_received: (p as { amount_received?: number | null }).amount_received ?? null,
        }))}
      />
    </div>
  );
}
