"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function numOrNull(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s);
}
function strOrNull(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

export async function createPolicy(customerId: string, formData: FormData) {
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

  if (error) throw new Error(error.message);

  redirect(`/policies/${data.id}`);
}

export async function updatePolicyDetails(policyId: string, formData: FormData) {
  const supabase = await createClient();

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

  if (error) throw new Error(error.message);
  revalidatePath(`/policies/${policyId}`);
}

export async function setDealStatus(policyId: string, status: "win" | "lost") {
  const supabase = await createClient();

  if (status === "win") {
    const { data: policy } = await supabase
      .from("policies")
      .select("insurance_company, net_premium")
      .eq("id", policyId)
      .single();

    if (!policy?.insurance_company || policy.net_premium == null) {
      throw new Error("ต้องกรอกบริษัทประกันและยอดประกันสุทธิก่อนปิดดีลเป็น Win");
    }
  }

  const { error } = await supabase
    .from("policies")
    .update({ deal_status: status })
    .eq("id", policyId);

  if (error) throw new Error(error.message);
  revalidatePath(`/policies/${policyId}`);
}

export async function reportPaymentTransfer(policyId: string, formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("policies")
    .update({
      payment_status: "awaiting_verification",
      payment_reference: strOrNull(formData.get("payment_reference")),
      payment_date: strOrNull(formData.get("payment_date")),
    })
    .eq("id", policyId);

  if (error) throw new Error(error.message);
  revalidatePath(`/policies/${policyId}`);
}

export async function verifyPayment(policyId: string, decision: "verified" | "rejected", note?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("policies")
    .update({
      payment_status: decision,
      verified_by: user.id,
      verified_at: new Date().toISOString(),
      ...(note ? { notes: note } : {}),
    })
    .eq("id", policyId);

  if (error) throw new Error(error.message);
  revalidatePath(`/policies/${policyId}`);
}
