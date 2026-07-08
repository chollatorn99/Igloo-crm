"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function assertManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "manager") throw new Error("เฉพาะ Manager เท่านั้น");
  return supabase;
}

export async function createUser(formData: FormData) {
  await assertManager();

  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "sales");

  if (!full_name || !email || password.length < 8) {
    throw new Error("กรอกชื่อ, อีเมล และรหัสผ่านอย่างน้อย 8 ตัวอักษร");
  }

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw new Error(createError.message);

  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: created.user.id, full_name, role });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw new Error(profileError.message);
  }

  revalidatePath("/settings");
}

export async function deleteUser(userId: string) {
  const supabase = await assertManager();
  const admin = createAdminClient();

  const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (!target) throw new Error("ไม่พบผู้ใช้");

  if (target.role === "manager") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "manager")
      .eq("status", "active");
    if ((count ?? 0) <= 1) {
      throw new Error("ห้ามลบ Manager คนสุดท้ายที่เหลืออยู่ในระบบ");
    }
  }

  const { count: customerCount } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);
  if ((customerCount ?? 0) > 0) {
    throw new Error("ผู้ใช้นี้ยังมีลูกค้าอยู่ในความรับผิดชอบ กรุณาโอนย้ายลูกค้าก่อนลบ");
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}

export async function updateCategoryDays(categoryId: string, formData: FormData) {
  const supabase = await assertManager();
  const days = Number(formData.get("renewal_reminder_days"));
  if (!Number.isFinite(days) || days < 0) throw new Error("จำนวนวันไม่ถูกต้อง");

  const { error } = await supabase
    .from("policy_categories")
    .update({ renewal_reminder_days: days })
    .eq("id", categoryId);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}

export async function addCategory(formData: FormData) {
  const supabase = await assertManager();
  const name = String(formData.get("name") ?? "").trim();
  const days = Number(formData.get("renewal_reminder_days") ?? 120);
  if (!name) throw new Error("กรอกชื่อประเภทกรมธรรม์");

  const { error } = await supabase.from("policy_categories").insert({ name, renewal_reminder_days: days });
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}

export async function bulkReassign(formData: FormData) {
  const supabase = await assertManager();
  const fromId = String(formData.get("from_owner_id") ?? "");
  const toId = String(formData.get("to_owner_id") ?? "");
  if (!fromId || !toId || fromId === toId) throw new Error("เลือกต้นทางและปลายทางให้ถูกต้อง");

  const { error } = await supabase.from("customers").update({ owner_id: toId }).eq("owner_id", fromId);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}
