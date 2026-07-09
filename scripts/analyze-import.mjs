import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const wb = XLSX.read(readFileSync(process.argv[2]), { cellDates: true });
const rows = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null });

const active = rows("ติดตามต่ออายุ");
const lapsed = rows("ลูกค้าที่ไม่ต่อประกัน");
const history = rows("ประวัติกรมธรรม์ทั้งหมด");

const customerNames = new Set();
for (const r of active) if (r["ชื่อลูกค้า"]) customerNames.add(String(r["ชื่อลูกค้า"]).trim());
for (const r of lapsed) if (r["ชื่อลูกค้า"]) customerNames.add(String(r["ชื่อลูกค้า"]).trim());
const historyNames = new Set(history.map((r) => String(r["ชื่อลูกค้า (กลุ่ม)"] ?? "").trim()).filter(Boolean));

const categories = {};
for (const r of active) {
  const c = String(r["ประเภทประกัน"] ?? "").trim() || "(ว่าง)";
  categories[c] = (categories[c] ?? 0) + 1;
}
const histCategories = {};
for (const r of history) {
  const c = String(r["ประเภท"] ?? "").trim() || "(ว่าง)";
  histCategories[c] = (histCategories[c] ?? 0) + 1;
}

const agents = {};
for (const r of history) {
  let a = String(r["Agent"] ?? "").trim();
  if (!a) continue;
  a = a.split(/\s*โอนคอม/)[0].trim();
  agents[a] = (agents[a] ?? 0) + 1;
}

const premiums = history.map((r) => Number(r["เบี้ยประกัน"] ?? 0)).filter((n) => n > 0);
const commission = history.filter((r) => r["ค่าคอม"] != null).length;
const discount = history.filter((r) => r["ส่วนลด"] != null).length;
const policyNo = history.filter((r) => String(r["เลขที่กรมธรรม์"] ?? "").trim()).length;
const noDate = history.filter((r) => !r["วันที่เริ่มคุ้มครอง"]).length;
const noPremium = history.length - premiums.length;

const inHistoryOnly = [...historyNames].filter((n) => !customerNames.has(n)).length;
const notInHistory = [...customerNames].filter((n) => !historyNames.has(n)).length;

console.log(JSON.stringify({
  customers_from_status_sheets: customerNames.size,
  customers_in_history: historyNames.size,
  history_only_customers: inHistoryOnly,
  status_customers_missing_from_history: notInHistory,
  policies_total: history.length,
  policies_no_start_date: noDate,
  policies_no_premium: noPremium,
  policies_with_commission: commission,
  policies_with_discount: discount,
  policies_with_policy_no: policyNo,
  premium_sum: premiums.reduce((a, b) => a + b, 0),
  active_sheet_categories: categories,
  history_categories: histCategories,
  agents,
}, null, 1));
