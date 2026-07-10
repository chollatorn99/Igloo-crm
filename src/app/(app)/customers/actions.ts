"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetchAll";
import { authorizeAndLogExport } from "@/app/(app)/export-actions";

type CustomerExportRow = {
  name: string;
  phone: string | null;
  customer_type: string;
  call_count: number;
  last_call_result: string | null;
  owner: { full_name: string } | null;
};

// Export pulls the FULL filtered set (not just the visible page) so the
// downloaded file matches "the current filter" per the requirement — the
// paginated table only renders 50 at a time for speed. Gated + logged +
// watermarked via authorizeAndLogExport (sales is refused).
export async function exportCustomers(
  q?: string,
): Promise<{ error?: string; rows?: Record<string, unknown>[]; watermark?: string }> {
  const supabase = await createClient();
  const dataRows = await fetchAll<CustomerExportRow>((from, to) => {
    let query = supabase
      .from("customers")
      .select("name, phone, customer_type, call_count, last_call_result, owner:profiles(full_name)")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (q?.trim()) {
      const term = q.trim().replace(/[%,()]/g, "");
      query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
    }
    return query as unknown as PromiseLike<{ data: CustomerExportRow[] | null; error: { message: string } | null }>;
  });

  const auth = await authorizeAndLogExport("customers", dataRows.length, q ? `ค้นหา: ${q}` : undefined);
  if (auth.error) return { error: auth.error };

  const rows = dataRows.map((c) => ({
    ชื่อ: c.name,
    เบอร์โทร: c.phone,
    ประเภท: c.customer_type === "organization" ? "องค์กร" : "บุคคล",
    เจ้าของ: c.owner?.full_name,
    จำนวนครั้งที่โทร: c.call_count,
    ผลล่าสุด: c.last_call_result,
  }));
  return { rows, watermark: auth.watermark };
}

export async function checkDuplicatePhone(phone: string) {
  if (!phone.trim()) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("check_phone_exists", { p_phone: phone.trim() });
  return data ?? [];
}

export async function createCustomer(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const customer_type = String(formData.get("customer_type") ?? "individual");
  const ownerIdInput = String(formData.get("owner_id") ?? "");
  const owner_id = ownerIdInput || user.id;

  if (!name) return { error: "กรุณากรอกชื่อลูกค้า" };

  const { data, error } = await supabase
    .from("customers")
    .insert({ name, phone, customer_type, owner_id })
    .select("id")
    .single();

  if (error) return { error: error.message };

  redirect(`/customers/${data.id}`);
}
