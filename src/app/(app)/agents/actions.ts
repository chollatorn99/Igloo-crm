"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string; message?: string };

export async function createAgent(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  if (!name) return { error: "กรุณากรอกชื่อ Agent" };

  const supabase = await createClient();
  const { error } = await supabase.from("agents").insert({ name, phone });
  if (error) return { error: error.message };

  revalidatePath("/agents");
  return { message: `เพิ่ม Agent "${name}" แล้ว` };
}

// Manager-only (enforced by RLS agents_write): hide/show an agent in the
// policy dropdown without deleting history.
export async function setAgentStatus(agentId: string, status: "active" | "inactive"): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("agents").update({ status }).eq("id", agentId);
  if (error) return { error: error.message };
  revalidatePath("/agents");
  return {};
}
