// Shared claim-stage definitions (server + client safe).
export const CLAIM_STAGES = [
  { key: "reported", label: "ลูกค้าแจ้งเคลม", date: "reported_date" },
  { key: "insurer_notified", label: "แจ้งประกัน", date: "insurer_reported_date" },
  { key: "survey", label: "Survey เข้าสำรวจ", date: "survey_date" },
  { key: "quote", label: "ช่างเสนอราคา", date: "quote_date" },
  { key: "negotiate", label: "ต่อรอง", date: "negotiate_date" },
  { key: "agreed", label: "ตกลง", date: "agreed_date" },
  { key: "paid", label: "จ่าย / จบเคลม", date: "paid_date" },
] as const;

export const CLAIM_STATUS_LABEL: Record<string, string> = {
  ...Object.fromEntries(CLAIM_STAGES.map((s) => [s.key, s.label])),
  rejected: "ปฏิเสธเคลม",
};
