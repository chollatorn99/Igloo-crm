import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setDealStatus, reportPaymentTransfer, verifyPayment } from "../actions";
import { PolicyEditForm } from "./edit-form";

const DEAL_STATUS_LABEL: Record<string, string> = {
  pending: "กำลังติดตาม",
  win: "Win",
  lost: "Lost",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "รอลูกค้าชำระ",
  awaiting_verification: "รอบัญชีตรวจสอบ",
  verified: "ตรวจสอบแล้ว",
  rejected: "สลิปไม่ผ่าน",
};

export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const { data: policy } = await supabase
    .from("policies")
    .select(
      "*, category:policy_categories(id, name), customer:customers(id, name, owner_id), agent:agents(id, name), verifier:profiles!policies_verified_by_fkey(full_name)",
    )
    .eq("id", id)
    .single();

  if (!policy) notFound();

  const [{ data: categories }, { data: agents }] = await Promise.all([
    supabase.from("policy_categories").select("id, name").eq("active", true).order("name"),
    supabase.from("agents").select("id, name").eq("status", "active").order("name"),
  ]);

  const role = profile?.role;
  const customer = policy.customer as { id: string; name: string; owner_id: string };
  const isOwnerOrManager = role === "manager" || customer.owner_id === user!.id;

  const markWin = setDealStatus.bind(null, id, "win");
  const markLost = setDealStatus.bind(null, id, "lost");
  const reportTransfer = reportPaymentTransfer.bind(null, id);
  const markVerified = verifyPayment.bind(null, id, "verified", undefined);
  const markRejected = verifyPayment.bind(null, id, "rejected", "สลิปไม่ผ่าน — ตรวจสอบอีกครั้ง");

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link href={`/customers/${customer.id}`} className="mb-4 inline-block text-xs text-slate-500 hover:underline">
        ← {customer.name}
      </Link>

      <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            {(policy.category as { name: string }).name}
          </h1>
          <p className="text-xs text-slate-500">{policy.insurance_company ?? "ยังไม่ระบุบริษัทประกัน"}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            policy.deal_status === "win"
              ? "bg-emerald-100 text-emerald-700"
              : policy.deal_status === "lost"
                ? "bg-rose-100 text-rose-700"
                : "bg-amber-100 text-amber-700"
          }`}
        >
          {DEAL_STATUS_LABEL[policy.deal_status]}
        </span>
      </div>

      {policy.deal_status === "pending" && isOwnerOrManager && (
        <div className="mb-6 flex gap-2 rounded-xl border border-slate-200 bg-white p-4">
          <form action={markWin}>
            <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              ปิดดีล Win
            </button>
          </form>
          <form action={markLost}>
            <button className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
              ปิดดีล Lost
            </button>
          </form>
          <p className="ml-2 self-center text-xs text-slate-400">
            (ต้องกรอกบริษัทประกัน+เบี้ยประกันก่อนจะปิด Win ได้)
          </p>
        </div>
      )}

      {policy.deal_status === "win" && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">การชำระเงิน</p>
          <p className="mb-3 text-sm text-slate-600">
            สถานะ: <strong>{PAYMENT_STATUS_LABEL[policy.payment_status] ?? "-"}</strong>
            {policy.payment_reference && ` · อ้างอิง: ${policy.payment_reference}`}
            {policy.payment_date && ` · โอนวันที่: ${policy.payment_date}`}
          </p>

          {policy.payment_status === "awaiting_payment" && isOwnerOrManager && (
            <form action={reportTransfer} className="flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-xs text-slate-500">เลขอ้างอิงการโอน</label>
                <input name="payment_reference" required className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">วันที่โอน</label>
                <input type="date" name="payment_date" required className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
              </div>
              <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                แจ้งโอนแล้ว
              </button>
            </form>
          )}

          {policy.payment_status === "awaiting_verification" && (role === "accounting" || role === "manager") && (
            <div className="flex gap-2">
              <form action={markVerified}>
                <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                  ตรวจสอบแล้ว
                </button>
              </form>
              <form action={markRejected}>
                <button className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
                  สลิปไม่ผ่าน
                </button>
              </form>
            </div>
          )}

          {policy.verifier && (
            <p className="mt-2 text-xs text-slate-400">
              ตรวจสอบโดย {(policy.verifier as { full_name: string }).full_name}
              {policy.verified_at && ` เมื่อ ${new Date(policy.verified_at).toLocaleString("th-TH")}`}
            </p>
          )}

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">ค่าคอมบริษัท</p>
              <p className="font-mono">{Number(policy.company_commission_amount ?? 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">ค่าคอม Agent</p>
              <p className="font-mono">{Number(policy.agent_commission_amount ?? 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">ค่าคอมสุทธิ Igloo</p>
              <p className="font-mono font-semibold">{Number(policy.net_commission_to_igloo ?? 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {isOwnerOrManager && (
        <PolicyEditForm policy={policy} categories={categories ?? []} agents={agents ?? []} />
      )}
    </div>
  );
}
