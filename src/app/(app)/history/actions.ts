"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetchAll";
import { authorizeAndLogExport } from "@/app/(app)/export-actions";

export type WinbackFilters = {
  status?: string;
  year?: string;
  category_id?: string;
  q?: string;
};

type ViewRow = {
  customer_id: string;
  name: string;
  phone: string | null;
  total_premium: number | null;
  latest_year: number | null;
  years_count: number | null;
  active: boolean;
  not_renewed: boolean;
  renewed: boolean;
  last_category: string | null;
  last_insurer: string | null;
  last_premium: number | null;
  last_coverage_end: string | null;
};

const dayMonth = (s: string | null) => {
  if (!s) return "-";
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const statusLabel = (r: ViewRow) =>
  r.not_renewed ? "ไม่ต่อ (ทำเครื่องหมาย)" : r.active ? "Active" : "ขาดการต่ออายุ";

// Fetches the full filtered win-back set from the aggregation view on demand
// (so the paginated page stays light) then builds the export rows.
export async function exportWinback(f: WinbackFilters) {
  const supabase = await createClient();

  const rows = await fetchAll<ViewRow>((from, to) => {
    let q = supabase.from("customer_winback").select("*").order("anniv_offset").range(from, to);
    if (f.status === "lapsed") q = q.eq("active", false);
    else if (f.status === "active") q = q.eq("active", true);
    else if (f.status === "renewed") q = q.eq("renewed", true);
    else if (f.status === "not_renewed") q = q.eq("not_renewed", true);
    if (f.year) q = q.eq("latest_year", Number(f.year));
    if (f.category_id) q = q.eq("last_category_id", f.category_id);
    if (f.q?.trim()) q = q.ilike("name", `%${f.q.trim().replace(/[%,()]/g, "")}%`);
    return q as unknown as PromiseLike<{ data: ViewRow[] | null; error: { message: string } | null }>;
  });

  const auth = await authorizeAndLogExport(
    "win-back",
    rows.length,
    [f.year && `ปี ${f.year}`, f.category_id && "กรองประเภท", f.status].filter(Boolean).join(", ") || undefined,
  );
  if (auth.error) return { error: auth.error };

  const exportRows = rows.map((r) => ({
    ลูกค้า: r.name,
    เบอร์โทร: r.phone,
    ประเภทล่าสุด: r.last_category ?? "-",
    หมดอายุ_วันเดือน: dayMonth(r.last_coverage_end),
    ปีที่ซื้อล่าสุด: r.latest_year,
    จำนวนปีที่ซื้อ: r.years_count,
    บริษัทประกันหลังสุด: r.last_insurer ?? "-",
    เบี้ยหลังสุด: r.last_premium,
    สถานะ: statusLabel(r),
  }));

  return { rows: exportRows, watermark: auth.watermark };
}
