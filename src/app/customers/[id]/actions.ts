"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addFollowUpNote(customerId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const note_text = String(formData.get("note_text") ?? "").trim();
  if (!note_text) return;

  const { error: noteError } = await supabase
    .from("follow_up_notes")
    .insert({ customer_id: customerId, author_id: user.id, note_text });
  if (noteError) throw new Error(noteError.message);

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

  revalidatePath(`/customers/${customerId}`);
}
