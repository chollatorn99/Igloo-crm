"use server";

import { createClient } from "@/lib/supabase/server";

export type ExportAuth = {
  error?: string;
  watermark?: string;
};

// Gatekeeper for every Excel export: blocks the sales role entirely
// (defense-in-depth — the UI also hides the button, but a sales user could
// call the action directly), records the export in export_log for
// traceability, and returns a watermark string to stamp into the file so a
// leaked copy points back to whoever downloaded it.
export async function authorizeAndLogExport(
  exportType: string,
  rowCount: number,
  filterNote?: string,
): Promise<ExportAuth> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "ไม่พบบัญชีผู้ใช้" };
  if (profile.role === "sales") {
    return { error: "role Sales ไม่มีสิทธิ์ Export ข้อมูล — กรุณาติดต่อผู้จัดการ" };
  }

  // Best-effort audit log: the role gate above is the hard control, so a
  // logging failure (e.g. the export_log table not yet created) must not
  // block a legitimate manager/accounting export. Once the table exists,
  // logging activates automatically.
  const { error: logError } = await supabase.from("export_log").insert({
    user_id: user.id,
    export_type: exportType,
    row_count: rowCount,
    filter_note: filterNote ?? null,
  });
  if (logError) console.error("export_log insert failed (non-fatal):", logError.message);

  const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  return {
    watermark: `ข้อมูลลับ Igloo Broker — ดาวน์โหลดโดย ${profile.full_name} (${user.email ?? ""}) เมื่อ ${stamp} UTC — ห้ามเผยแพร่`,
  };
}
