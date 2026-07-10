"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function changePassword(formData: FormData): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  if (password !== confirm) return { error: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };

  // Update the password server-side so the refreshed session tokens are
  // written back through the SSR cookie handler in the same request. Doing
  // this on the browser client instead left the server cookies stale, so
  // the next navigation's middleware saw an invalid session and bounced the
  // user back to /login right after a successful change.
  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) return { error: updateError.message };

  // profiles has no client-writable update policy — flip the flag with the
  // service-role client, scoped to the caller's own verified session id.
  const admin = createAdminClient();
  const { error: profileError } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);
  if (profileError) return { error: profileError.message };

  redirect("/");
}
