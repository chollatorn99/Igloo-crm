"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

type ActionResult = { error?: string };

export async function addFollowUpNote(customerId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const note_text = String(formData.get("note_text") ?? "").trim();
  if (!note_text) return {};

  const { error: noteError } = await supabase
    .from("follow_up_notes")
    .insert({ customer_id: customerId, author_id: user.id, note_text });
  if (noteError) return { error: noteError.message };

  // Every logged call counts toward the call-count metric — matches the
  // requirement that call counts come from logging a note, not a separate entry.
  const { data: customer } = await supabase
    .from("customers")
    .select("call_count")
    .eq("id", customerId)
    .single();

  await supabase
    .from("customers")
    .update({ call_count: (customer?.call_count ?? 0) + 1, last_call_result: note_text.slice(0, 120) })
    .eq("id", customerId);

  const { data: c } = await supabase.from("customers").select("name").eq("id", customerId).single();
  await logActivity(supabase, {
    action: "call_logged",
    summary: `บันทึกการติดตาม: ${c?.name ?? "-"} — ${note_text.slice(0, 60)}`,
    entityId: customerId,
    customerId,
  });

  revalidatePath(`/customers/${customerId}`);
  return {};
}

export async function updateCustomerInfo(customerId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "ต้องมีชื่อลูกค้า" };
  const clean = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };

  // RLS (customers_update) decides whether this user may edit this row —
  // owner / their support / a manager / a shared-prospect salesperson.
  const { error } = await supabase
    .from("customers")
    .update({
      name,
      phone: clean("phone"),
      email: clean("email"),
      address: clean("address"),
      line_id: clean("line_id"),
      customer_type: formData.get("customer_type") === "organization" ? "organization" : "individual",
    })
    .eq("id", customerId);
  if (error) return { error: error.message };

  revalidatePath(`/customers/${customerId}`);
  return {};
}

export async function reassignOwner(customerId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const newOwnerId = String(formData.get("owner_id") ?? "");
  if (!newOwnerId) return {};

  // enforce_owner_change trigger blocks this for non-managers and writes
  // the audit log row — this is just the UI trigger for it.
  const { error } = await supabase.from("customers").update({ owner_id: newOwnerId }).eq("id", customerId);
  if (error) return { error: error.message };

  revalidatePath(`/customers/${customerId}`);
  return {};
}
