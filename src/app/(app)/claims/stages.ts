// Shared claim-stage definitions (server + client safe). Each stage has a date
// field + a note field.
export const CLAIM_STAGES = [
  { key: "reported", label: "ลูกค้าแจ้งเคลม", date: "reported_date", note: "reported_note" },
  { key: "insurer_notified", label: "แจ้งประกัน", date: "insurer_reported_date", note: "insurer_reported_note" },
  { key: "survey", label: "Survey เข้าสำรวจ", date: "survey_date", note: "survey_note" },
  { key: "survey_followup", label: "ติดตาม Survey หลังเข้าสำรวจ", date: "survey_followup_date", note: "survey_followup_note" },
  { key: "customer_followup", label: "ติดตามลูกค้า หลังเข้าสำรวจ", date: "customer_followup_date", note: "customer_followup_note" },
  { key: "quote", label: "ช่างเสนอราคา", date: "quote_date", note: "quote_note" },
  { key: "negotiate", label: "ต่อรอง", date: "negotiate_date", note: "negotiate_note" },
  { key: "agreed", label: "ตกลง", date: "agreed_date", note: "agreed_note" },
  { key: "paid", label: "จ่าย / จบเคลม", date: "paid_date", note: "paid_note" },
] as const;

export const CLAIM_STATUS_LABEL: Record<string, string> = {
  ...Object.fromEntries(CLAIM_STAGES.map((s) => [s.key, s.label])),
  rejected: "ปฏิเสธเคลม",
};

// Per-claimant (group member) status.
export const CLAIMANT_STATUS_LABEL: Record<string, string> = {
  pending: "รอดำเนินการ",
  approved: "อนุมัติ",
  rejected: "ปฏิเสธ",
  paid: "จ่ายแล้ว",
};

// Days a claim should be closed within, by policy type: health / golf = 14,
// everything else (IAR, PL, …) = 30. Derived from the linked policy's category.
export function claimSlaDays(categoryName: string | null | undefined): number {
  const c = (categoryName ?? "").toLowerCase();
  if (c.includes("health") || c.includes("สุขภาพ") || c.includes("golf") || c.includes("กอล์ฟ")) return 14;
  return 30;
}

export function addDays(dateStr: string | null | undefined, days: number): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.slice(0, 10) + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// A claim is "closed" once it is paid or rejected.
export const CLAIM_CLOSED = ["paid", "rejected"];
