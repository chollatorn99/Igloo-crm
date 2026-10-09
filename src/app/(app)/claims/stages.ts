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
