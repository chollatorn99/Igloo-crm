"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Next.js redacts thrown Server Action errors in production builds down to
// a generic "An error occurred in the Server Components render" message —
// only visible with dev-mode testing, which is why this wasn't caught
// earlier. Every action here returns { error } instead of throwing so the
// real message actually reaches the client.
type ActionResult = { error?: string };

// Returns an error message if the caller isn't a manager, or null if they are.
async function managerCheckError(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "manager") return "เฉพาะ Manager เท่านั้น";
  return null;
}

export async function createUser(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const authError = await managerCheckError(supabase);
  if (authError) return { error: authError };

  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "sales");

  if (!full_name || !email || password.length < 8) {
    return { error: "กรอกชื่อ, อีเมล และรหัสผ่านอย่างน้อย 8 ตัวอักษร" };
  }

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) return { error: createError.message };

  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: created.user.id, full_name, role });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profileError.message };
  }

  revalidatePath("/settings");
  return {};
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const authError = await managerCheckError(supabase);
  if (authError) return { error: authError };
  const admin = createAdminClient();

  const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (!target) return { error: "ไม่พบผู้ใช้" };

  if (target.role === "manager") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "manager")
      .eq("status", "active");
    if ((count ?? 0) <= 1) {
      return { error: "ห้ามลบ Manager คนสุดท้ายที่เหลืออยู่ในระบบ" };
    }
  }

  const { count: customerCount } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);
  if ((customerCount ?? 0) > 0) {
    return { error: "ผู้ใช้นี้ยังมีลูกค้าอยู่ในความรับผิดชอบ กรุณาโอนย้ายลูกค้าก่อนลบ" };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return {};
}

export async function updateCategoryDays(categoryId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const authError = await managerCheckError(supabase);
  if (authError) return { error: authError };

  const days = Number(formData.get("renewal_reminder_days"));
  if (!Number.isFinite(days) || days < 0) return { error: "จำนวนวันไม่ถูกต้อง" };

  const { error } = await supabase
    .from("policy_categories")
    .update({ renewal_reminder_days: days })
    .eq("id", categoryId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return {};
}

export async function addCategory(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const authError = await managerCheckError(supabase);
  if (authError) return { error: authError };

  const name = String(formData.get("name") ?? "").trim();
  const days = Number(formData.get("renewal_reminder_days") ?? 120);
  if (!name) return { error: "กรอกชื่อประเภทกรมธรรม์" };

  const { error } = await supabase.from("policy_categories").insert({ name, renewal_reminder_days: days });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return {};
}

export async function bulkReassign(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const authError = await managerCheckError(supabase);
  if (authError) return { error: authError };

  const fromId = String(formData.get("from_owner_id") ?? "");
  const toId = String(formData.get("to_owner_id") ?? "");
  if (!fromId || !toId || fromId === toId) return { error: "เลือกต้นทางและปลายทางให้ถูกต้อง" };

  const { error } = await supabase.from("customers").update({ owner_id: toId }).eq("owner_id", fromId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return {};
}
