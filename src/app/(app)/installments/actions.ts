"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const s = (v: FormDataEntryValue | null) => { const x = String(v ?? "").trim(); return x === "" ? null : x; };
const n = (v: FormDataEntryValue | null) => { const x = String(v ?? "").trim(); return x === "" ? null : Number(x); };

// Tick a single installment paid / unpaid. When ticking paid with no date, use
// today (Thai) so staff don't have to fill it every time.
export async function setInstallmentPaid(id: string, paid: boolean, paidDate: string | null): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("installment_payments")
    .update({
      paid,
      paid_date: paid ? paidDate ?? new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10) : null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/installments");
  return {};
}

export async function updateInstallment(id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("installment_payments")
    .update({
      due_date: s(formData.get("due_date")),
      amount: n(formData.get("amount")),
      paid_date: s(formData.get("paid_date")),
      paid: formData.get("paid") === "on",
      note: s(formData.get("note")),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/installments");
  return {};
}
