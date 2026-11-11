"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const num = (v: FormDataEntryValue | null) => { const x = String(v ?? "").trim(); return x === "" ? null : Number(x); };

export async function saveTarget(ownerId: string, month: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("report_targets")
    .upsert(
      { owner_id: ownerId, month, target_premium: num(formData.get("target_premium")), existing_target: num(formData.get("existing_target")), updated_at: new Date().toISOString() },
      { onConflict: "owner_id,month" },
    );
  if (error) return { error: error.message };
  revalidatePath("/daily-report");
  return {};
}

export async function saveDailyEntry(ownerId: string, reportDate: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_report_entries")
    .upsert(
      {
        owner_id: ownerId,
        report_date: reportDate,
        new_quotes: num(formData.get("new_quotes")),
        tbd: num(formData.get("tbd")),
        new_calls: num(formData.get("new_calls")),
        follow_ups: num(formData.get("follow_ups")),
        no_response: num(formData.get("no_response")),
        wrong_number: num(formData.get("wrong_number")),
        note: String(formData.get("note") ?? "").trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id,report_date" },
    );
  if (error) return { error: error.message };
  revalidatePath("/daily-report");
  return {};
}
