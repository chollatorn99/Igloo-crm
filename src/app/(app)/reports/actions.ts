"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetchAll";

// Vehicle categories — only these carry a plate/vehicle detail worth exporting.
const MOTOR_CATS = ["Motor", "พรบ.รถ", "CAR", "พรบ.ปั้ม"];

type PolicyRow = {
  closed_date: string | null;
  coverage_end_date: string | null;
  insurance_company: string | null;
  policy_detail: string | null;
  net_premium: number | null;
  stamp_duty: number | null;
  vat: number | null;
  total_premium: number | null;
  payment_date: string | null;
  category: { name: string } | null;
  customer: { name: string } | null;
};

// Date-range sales export for sales / support (and manager). RLS scopes each
// user to their own book, and the column set deliberately omits phone and any
// commission — customer name, policy and money fields only.
export async function exportSalesReport(from: string, to: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
  if (!profile) return { error: "ไม่พบบัญชีผู้ใช้" };
  if (!["manager", "sales", "support", "accounting"].includes(profile.role)) return { error: "ไม่มีสิทธิ์ Export" };
  if (!from || !to) return { error: "กรุณาเลือกช่วงวันที่" };

  const policies = await fetchAll<PolicyRow>((f, t) => {
    const q = supabase
      .from("policies")
      .select(
        "closed_date, coverage_end_date, insurance_company, policy_detail, net_premium, stamp_duty, vat, total_premium, payment_date, category:policy_categories(name), customer:customers!inner(name)",
      )
      .eq("deal_status", "win")
      .eq("is_prospect", false) // dealer prospects aren't our sales
      .gte("closed_date", from)
      .lte("closed_date", to)
      .order("closed_date")
      .range(f, t);
    return q as unknown as PromiseLike<{ data: PolicyRow[] | null; error: { message: string } | null }>;
  });

  // Best-effort audit trail (mirrors the manager exports).
  await supabase
    .from("export_log")
    .insert({ user_id: user.id, export_type: "sales-report", row_count: policies.length, filter_note: `${from}..${to}` });

  const rows = policies.map((p) => ({
    "ชื่อลูกค้า": p.customer?.name ?? "",
    "ประเภทประกัน": p.category?.name ?? "",
    "บริษัทประกัน": p.insurance_company ?? "",
    "ทะเบียน/รุ่นรถ": p.category && MOTOR_CATS.includes(p.category.name) ? (p.policy_detail ?? "") : "",
    "วันแจ้งงาน": p.closed_date ?? "",
    "วันหมดอายุ": p.coverage_end_date ?? "",
    "เบี้ยสุทธิ": p.net_premium ?? 0,
    "อากรแสตมป์": p.stamp_duty ?? 0,
    "ภาษี (VAT)": p.vat ?? 0,
    "เบี้ยรวม": p.total_premium ?? 0,
    "วันชำระเงิน": p.payment_date ?? "",
  }));

  const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  return {
    rows,
    watermark: `Igloo Broker — ดาวน์โหลดโดย ${profile.full_name} (${user.email ?? ""}) เมื่อ ${stamp} UTC — ห้ามเผยแพร่`,
  };
}
