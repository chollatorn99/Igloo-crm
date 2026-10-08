"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string };
const s = (v: FormDataEntryValue | null) => { const x = String(v ?? "").trim(); return x === "" ? null : x; };
const n = (v: FormDataEntryValue | null) => { const x = String(v ?? "").trim(); return x === "" ? null : Number(x); };

export async function createClaim(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const customer_id = s(formData.get("customer_id"));
  if (!customer_id) return { error: "ไม่พบลูกค้า" };
  // The claim is owned by the customer's salesperson so it appears under them.
  const { data: cust } = await supabase.from("customers").select("owner_id").eq("id", customer_id).single();
  if (!cust) return { error: "ไม่พบลูกค้า" };

  const { data, error } = await supabase
    .from("claims")
    .insert({
      customer_id,
      owner_id: cust.owner_id,
      created_by: user.id,
      policy_id: s(formData.get("policy_id")),
      claim_number: s(formData.get("claim_number")),
      claimant_name: s(formData.get("claimant_name")),
      detail: s(formData.get("detail")),
      claim_amount: n(formData.get("claim_amount")),
      reported_date: s(formData.get("reported_date")),
      next_followup_date: s(formData.get("next_followup_date")),
      status: "reported",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  redirect(`/claims/${data.id}`);
}

export async function updateClaim(claimId: string, formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("claims")
    .update({
      claim_number: s(formData.get("claim_number")),
      claimant_name: s(formData.get("claimant_name")),
      status: s(formData.get("status")) ?? "reported",
      detail: s(formData.get("detail")),
      claim_amount: n(formData.get("claim_amount")),
      policy_id: s(formData.get("policy_id")),
      reported_date: s(formData.get("reported_date")),
      insurer_reported_date: s(formData.get("insurer_reported_date")),
      survey_date: s(formData.get("survey_date")),
      quote_date: s(formData.get("quote_date")),
      negotiate_date: s(formData.get("negotiate_date")),
      agreed_date: s(formData.get("agreed_date")),
      paid_date: s(formData.get("paid_date")),
      next_followup_date: s(formData.get("next_followup_date")),
      notes: s(formData.get("notes")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", claimId);
  if (error) return { error: error.message };
  revalidatePath(`/claims/${claimId}`);
  return {};
}

export async function addClaimNote(claimId: string, formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const note_text = String(formData.get("note_text") ?? "").trim();
  if (!note_text) return {};
  const { error } = await supabase.from("claim_notes").insert({ claim_id: claimId, author_id: user.id, note_text });
  if (error) return { error: error.message };
  revalidatePath(`/claims/${claimId}`);
  return {};
}

export async function deleteClaim(claimId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("claims").delete().eq("id", claimId);
  if (error) return { error: error.message };
  redirect("/claims");
}
