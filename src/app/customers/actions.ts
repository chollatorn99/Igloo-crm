"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
