"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Report a COMBINED payment across several policies (e.g. a petrol station that
// pays IAR + PL + พ.ร.บ. together on one transfer): same reference + date on
// all, and the single actual amount received stored on each so the payments
// page can group by reference and show the difference vs the policy total.
const PAID_DIRECT = "จ่ายตรงกับบริษัทประกัน";

export async function reportPaymentBulk(payload: {
  ids: string[];
  reference: string;
  date: string | null;
  amountReceived: number | null;
  channel: string | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const ids = (payload.ids ?? []).filter(Boolean);
  if (ids.length === 0) return { error: "ยังไม่ได้เลือกกรมธรรม์" };
  // Paid straight to the insurer → no Igloo transfer slip, so the reference is
  // optional; every other channel still needs one.
  if (payload.channel !== PAID_DIRECT && !payload.reference?.trim()) return { error: "กรุณาใส่เลขที่อ้างอิง" };

  const { error } = await supabase
    .from("policies")
    .update({
      payment_status: "awaiting_verification",
      payment_reference: payload.reference.trim() || null,
      payment_date: payload.date || null,
      amount_received: payload.amountReceived,
      payment_channel: payload.channel || null,
    })
    .in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/payments");
  return {};
}
