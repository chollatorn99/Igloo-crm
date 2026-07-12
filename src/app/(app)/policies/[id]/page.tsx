import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setDealStatus, verifyPayment, setRenewalOutcome } from "../actions";
import { PolicyEditForm } from "./edit-form";
import { PaymentReportForm } from "./payment-report-form";
import { ActionForm } from "@/components/ActionForm";

const DEAL_STATUS_LABEL: Record<string, string> = {
  pending: "กำลังติดตาม",
  win: "Win",
  lost: "Lost",
};

const RENEWAL_OUTCOME_LABEL: Record<string, string> = {
  pending: "รอติดตาม",
  renewed: "ต่อแล้ว",
  not_renewed: "ไม่ต่อ",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  transfer_igloo: "โอนเข้าอิกลู",
  transfer_insurer: "โอนให้บริษัทประกัน",
  credit_card: "บัตรเครดิต",
  installment_igloo: "ผ่อนกับอิกลู",
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
  const customer = policy.customer as unknown as { id: string; name: string; owner_id: string };
  const isOwnerOrManager = role === "manager" || customer.owner_id === user!.id;

  const markWin = setDealStatus.bind(null, id, "win");
  const markLost = setDealStatus.bind(null, id, "lost");
  const markVerified = verifyPayment.bind(null, id, "verified", undefined);
  const markRejected = verifyPayment.bind(null, id, "rejected", "สลิปไม่ผ่าน — ตรวจสอบอีกครั้ง");
  const markRenewed = setRenewalOutcome.bind(null, id, "renewed");
  const markNotRenewed = setRenewalOutcome.bind(null, id, "not_renewed");
  const markRenewalPending = setRenewalOutcome.bind(null, id, "pending");

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link href={`/customers/${customer.id}`} className="mb-4 inline-block text-xs text-slate-500 hover:underline">
        ← {customer.name}
      </Link>

      <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            {(policy.category as unknown as { name: string }).name}
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

      {/* Renewal follow-up outcome — only meaningful for a won policy, kept
          separate from deal_status so revenue/history are never altered. */}
      {policy.deal_status === "win" && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-700">ผลการติดตามต่ออายุ</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                policy.renewal_outcome === "renewed"
                  ? "bg-emerald-100 text-emerald-700"
                  : policy.renewal_outcome === "not_renewed"
                    ? "bg-rose-100 text-rose-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {RENEWAL_OUTCOME_LABEL[policy.renewal_outcome] ?? "รอติดตาม"}
            </span>
          </div>
          {isOwnerOrManager && (
            <div className="flex flex-wrap items-center gap-2">
              <ActionForm action={markRenewed}>
                <button className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                  ต่อแล้ว
                </button>
              </ActionForm>
              <ActionForm action={markNotRenewed}>
                <button className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700">
                  ไม่ต่อ
                </button>
              </ActionForm>
              <ActionForm action={markRenewalPending}>
                <button className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                  ล้าง (รอติดตาม)
                </button>
              </ActionForm>
              <p className="text-xs text-slate-400">
                &quot;ไม่ต่อ&quot; จะเอาออกจากรายการแจ้งเตือนต่ออายุ โดยไม่กระทบยอดขายเดิม
              </p>
            </div>
          )}
        </div>
      )}

      {policy.deal_status === "pending" && isOwnerOrManager && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
          <ActionForm action={markWin}>
            <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              ปิดดีล Win
            </button>
          </ActionForm>
          <ActionForm action={markLost}>
            <button className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
              ปิดดีล Lost
            </button>
          </ActionForm>
          <p className="text-xs text-slate-400">
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

          {policy.payment_method && (
            <p className="mb-3 text-sm text-slate-600">
              วิธีรับชำระ: <strong>{PAYMENT_METHOD_LABEL[policy.payment_method] ?? "-"}</strong>
              {policy.installment_count ? ` · ${policy.installment_count} งวด` : ""}
              {policy.installment_amount ? ` · งวดละ ${Number(policy.installment_amount).toLocaleString()} บาท` : ""}
            </p>
          )}

          {policy.payment_status === "awaiting_payment" && isOwnerOrManager && (
            <PaymentReportForm policyId={id} />
          )}

          {policy.payment_status === "awaiting_verification" && (role === "accounting" || role === "manager") && (
            <div className="flex flex-wrap gap-2">
              <ActionForm action={markVerified}>
                <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                  ตรวจสอบแล้ว
                </button>
              </ActionForm>
              <ActionForm action={markRejected}>
                <button className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
                  สลิปไม่ผ่าน
                </button>
              </ActionForm>
            </div>
          )}

          {policy.verifier && (
            <p className="mt-2 text-xs text-slate-400">
              ตรวจสอบโดย {(policy.verifier as unknown as { full_name: string }).full_name}
              {policy.verified_at && ` เมื่อ ${new Date(policy.verified_at).toLocaleString("th-TH")}`}
            </p>
          )}

          {isOwnerOrManager && (
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-sm">
              {/* Agent commission is what the freelancer is owed — the
                  owning salesperson needs to see it. Company commission and
                  net-to-Igloo are company revenue, so manager-only. */}
              <div>
                <p className="text-xs text-slate-400">ค่าคอม Agent</p>
                <p className="font-mono">{Number(policy.agent_commission_amount ?? 0).toLocaleString()}</p>
              </div>
              {role === "manager" && (
                <>
                  <div>
                    <p className="text-xs text-slate-400">ค่าคอมบริษัท</p>
                    <p className="font-mono">{Number(policy.company_commission_amount ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">ค่าคอมบริษัทหลังหัก Agent</p>
                    <p className="font-mono font-semibold">
                      {Number(policy.net_commission_to_igloo ?? 0).toLocaleString()}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {isOwnerOrManager && (
        <PolicyEditForm
          policy={policy}
          categories={categories ?? []}
          agents={agents ?? []}
          isManager={role === "manager"}
        />
      )}
    </div>
  );
}
