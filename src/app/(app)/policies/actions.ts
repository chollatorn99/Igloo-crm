"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Next.js redacts thrown Server Action errors in production builds down to
// a generic message — only visible with dev-mode testing. Every action
// here returns { error } instead of throwing so the real message reaches
// the client. redirect() is unaffected (it's Next's own control-flow
// signal, not a regular thrown Error) so success paths are unchanged.
type ActionResult = { error?: string };

function numOrNull(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s);
}
function strOrNull(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

export async function createPolicy(customerId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("policies")
    .insert({
      customer_id: customerId,
      category_id: formData.get("category_id"),
      insurance_company: strOrNull(formData.get("insurance_company")),
      policy_detail: strOrNull(formData.get("policy_detail")),
      coverage_start_date: strOrNull(formData.get("coverage_start_date")),
      coverage_end_date: strOrNull(formData.get("coverage_end_date")),
      net_premium: numOrNull(formData.get("net_premium")),
      stamp_duty: numOrNull(formData.get("stamp_duty")) ?? 0,
      vat: numOrNull(formData.get("vat")) ?? 0,
      company_commission_rate: numOrNull(formData.get("company_commission_rate")),
      agent_id: strOrNull(formData.get("agent_id")),
      agent_commission_rate: numOrNull(formData.get("agent_commission_rate")),
      customer_discount_amount: numOrNull(formData.get("customer_discount_amount")) ?? 0,
      notes: strOrNull(formData.get("notes")),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  redirect(`/policies/${data.id}`);
}

export async function updatePolicyDetails(policyId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  // Sales enters the insurer commission % themselves; the derived baht
  // amount stays hidden from them in the UI (manager-only display).
  const { error } = await supabase
    .from("policies")
    .update({
      category_id: formData.get("category_id"),
      insurance_company: strOrNull(formData.get("insurance_company")),
      policy_detail: strOrNull(formData.get("policy_detail")),
      coverage_start_date: strOrNull(formData.get("coverage_start_date")),
      coverage_end_date: strOrNull(formData.get("coverage_end_date")),
      net_premium: numOrNull(formData.get("net_premium")),
      stamp_duty: numOrNull(formData.get("stamp_duty")) ?? 0,
      vat: numOrNull(formData.get("vat")) ?? 0,
      total_collectible: numOrNull(formData.get("total_collectible")),
      company_commission_rate: numOrNull(formData.get("company_commission_rate")),
      agent_id: strOrNull(formData.get("agent_id")),
      agent_commission_rate: numOrNull(formData.get("agent_commission_rate")),
      customer_discount_amount: numOrNull(formData.get("customer_discount_amount")) ?? 0,
      notes: strOrNull(formData.get("notes")),
    })
    .eq("id", policyId);

  if (error) return { error: error.message };
  revalidatePath(`/policies/${policyId}`);
  return {};
}

export async function setDealStatus(policyId: string, status: "win" | "lost"): Promise<ActionResult> {
  const supabase = await createClient();

  if (status === "win") {
    const { data: policy } = await supabase
      .from("policies")
      .select("insurance_company, net_premium")
      .eq("id", policyId)
      .single();

    if (!policy?.insurance_company || policy.net_premium == null) {
      return { error: "ต้องกรอกบริษัทประกันและยอดประกันสุทธิก่อนปิดดีลเป็น Win" };
    }
  }

  // Stamp the conclusion date on Lost too (the win path gets it from the
  // DB trigger) so the dashboard's period filter/win-rate can place lost
  // deals in the right month.
  const update: { deal_status: string; closed_date?: string } =
    status === "lost" ? { deal_status: status, closed_date: new Date().toISOString().slice(0, 10) } : { deal_status: status };

  const { error } = await supabase.from("policies").update(update).eq("id", policyId);

  if (error) return { error: error.message };
  revalidatePath(`/policies/${policyId}`);
  return {};
}

export async function reportPaymentTransfer(policyId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const method = strOrNull(formData.get("payment_method"));
  // Installments only apply to credit-card / pay-with-Igloo plans.
  const takesInstallments = method === "credit_card" || method === "installment_igloo";

  const { error } = await supabase
    .from("policies")
    .update({
      payment_status: "awaiting_verification",
      payment_reference: strOrNull(formData.get("payment_reference")),
      payment_date: strOrNull(formData.get("payment_date")),
      payment_method: method,
      installment_count: takesInstallments ? numOrNull(formData.get("installment_count")) : null,
      installment_amount:
        method === "installment_igloo" ? numOrNull(formData.get("installment_amount")) : null,
    })
    .eq("id", policyId);

  if (error) return { error: error.message };
  revalidatePath(`/policies/${policyId}`);
  return {};
}

export async function verifyPayment(
  policyId: string,
  decision: "verified" | "rejected",
  note?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("policies")
    .update({
      payment_status: decision,
      verified_by: user.id,
      verified_at: new Date().toISOString(),
      ...(note ? { notes: note } : {}),
    })
    .eq("id", policyId);

  if (error) return { error: error.message };
  revalidatePath(`/policies/${policyId}`);
  return {};
}

// Add a year to a YYYY-MM-DD string, clamping Feb-29 -> Feb-28.
function addOneYear(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const ny = y + 1;
  // Feb 29 -> Feb 28 in a non-leap next year.
  const day = m === 2 && d === 29 && !(ny % 4 === 0 && (ny % 100 !== 0 || ny % 400 === 0)) ? 28 : d;
  return `${ny}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// "ต่ออายุ" = one year's renewal is a NEW policy row (1 policy = 1 yearly
// deal), never an overwrite — that keeps the old year's history and lets the
// new year count as fresh revenue. Clicking it means the deal is CLOSED: we
// clone the old policy's terms (insurer/premium/agent/commission), shift
// coverage +1 year, and create it as a Win closed today so it counts on the
// dashboard immediately. Premium/insurer/ประเภท stay editable afterward via
// the edit form (renewals often change terms). The old policy is flagged
// renewed in the same step.
export async function renewPolicy(policyId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: old, error: readErr } = await supabase
    .from("policies")
    .select(
      "customer_id, category_id, insurance_company, policy_detail, coverage_start_date, coverage_end_date, net_premium, stamp_duty, vat, company_commission_rate, agent_id, agent_commission_rate, customer_discount_amount",
    )
    .eq("id", policyId)
    .single();

  if (readErr || !old) return { error: readErr?.message ?? "ไม่พบกรมธรรม์เดิม" };

  // New coverage runs from where the old one ends; if unknown, leave blank.
  const newStart = old.coverage_end_date ?? null;
  const newEnd = addOneYear(old.coverage_end_date) ?? addOneYear(old.coverage_start_date);
  const oldYear = old.coverage_start_date ? old.coverage_start_date.slice(0, 4) : "";

  const { data: created, error: insErr } = await supabase
    .from("policies")
    .insert({
      customer_id: old.customer_id,
      category_id: old.category_id,
      insurance_company: old.insurance_company,
      policy_detail: old.policy_detail,
      coverage_start_date: newStart,
      coverage_end_date: newEnd,
      net_premium: old.net_premium,
      stamp_duty: old.stamp_duty ?? 0,
      vat: old.vat ?? 0,
      company_commission_rate: old.company_commission_rate,
      agent_id: old.agent_id,
      agent_commission_rate: old.agent_commission_rate,
      customer_discount_amount: old.customer_discount_amount ?? 0,
      notes: `ต่ออายุจากกรมธรรม์ปี ${oldYear} — แก้ไขประเภท/บริษัท/เบี้ยได้ตามจริง`,
      // Closed the moment "ต่ออายุ" is pressed. The transitions trigger is
      // UPDATE-only, so on this fresh INSERT we set closed_date (= today, the
      // revenue-reporting date) and payment_status ourselves.
      deal_status: "win",
      closed_date: new Date().toISOString().slice(0, 10),
      payment_status: "awaiting_payment",
    })
    .select("id")
    .single();

  if (insErr || !created) return { error: insErr?.message ?? "สร้างกรมธรรม์ใหม่ไม่สำเร็จ" };

  // Flag the old policy renewed so it drops off the reminder list. Pass all
  // three params (p_reason: null) so PostgREST resolves the 3-arg overload
  // unambiguously — a 2-arg call clashes with the legacy 2-arg function.
  const { error: rpcErr } = await supabase.rpc("set_renewal_outcome", {
    p_policy_id: policyId,
    p_outcome: "renewed",
    p_reason: null,
  });
  // Non-fatal: the new policy already exists; surface but don't block.
  if (rpcErr) return { error: `สร้างกรมธรรม์ใหม่แล้ว แต่ติดธง 'ต่อแล้ว' ไม่สำเร็จ: ${rpcErr.message}` };

  revalidatePath("/renewals");
  redirect(`/policies/${created.id}`);
}

// Records the renewal follow-up outcome (Option B) — separate from
// deal_status so it never touches the historical Win/revenue. Goes through
// the set_renewal_outcome DB function, which enforces owner/manager scope.
export async function setRenewalOutcome(
  policyId: string,
  outcome: "pending" | "renewed" | "not_renewed",
  formData?: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  // Only "ไม่ต่อ" carries a reason; the DB function clears it otherwise.
  const reason = outcome === "not_renewed" ? strOrNull(formData?.get("not_renewed_reason") ?? null) : null;
  const { error } = await supabase.rpc("set_renewal_outcome", {
    p_policy_id: policyId,
    p_outcome: outcome,
    p_reason: reason,
  });

  if (error) return { error: error.message };
  revalidatePath(`/policies/${policyId}`);
  revalidatePath("/renewals");
  return {};
}
