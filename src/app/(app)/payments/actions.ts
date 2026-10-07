"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Report a COMBINED payment across several policies (e.g. a petrol station that
// pays IAR + PL + พ.ร.บ. together on one transfer): same reference + date on
// all, and the single actual amount received stored on each so the payments
// page can group by reference and show the difference vs the policy total.
export async function reportPaymentBulk(payload: {
  ids: string[];
  reference: string;
  date: string | null;
  amountReceived: number | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const ids = (payload.ids ?? []).filter(Boolean);
  if (ids.length === 0) return { error: "ยังไม่ได้เลือกกรมธรรม์" };
  if (!payload.reference?.trim()) return { error: "กรุณาใส่เลขที่อ้างอิง" };

  const { error } = await supabase
    .from("policies")
    .update({
      payment_status: "awaiting_verification",
      payment_reference: payload.reference.trim(),
      payment_date: payload.date || null,
      amount_received: payload.amountReceived,
    })
    .in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/payments");
  return {};
}
