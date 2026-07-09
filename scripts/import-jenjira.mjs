// One-off import of Jenjira's 2018-2026 customer/policy history from the
// per-owner Excel file into Supabase. Run with DRY=1 for a no-write preview.
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const FILE = process.argv[2];
const OWNER_ID = "984585f3-52e3-4283-8139-00bdd2362e19"; // Jenjira Kaewpa
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.env.DRY === "1";

const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function rest(method, path, body, prefer) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: { ...HEADERS, ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Excel date cells arrive as JS Dates shifted by the local timezone (Thai
// midnight ≈ 16:59:5x UTC the previous day) — round to the nearest UTC day
// to recover the intended calendar date.
function toDateStr(v) {
  if (v == null || v === "") return null;
  let ms;
  if (v instanceof Date) ms = v.getTime() + 7 * 3600e3;
  else if (typeof v === "number") ms = (v - 25569) * 86400e3;
  else return null;
  const rounded = Math.round(ms / 86400e3) * 86400e3;
  return new Date(rounded).toISOString().slice(0, 10);
}

function plusOneYear(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  // Feb 29 + 1 year lands on a date that doesn't exist — clamp to Feb 28.
  const day = m === 2 && d === 29 ? 28 : d;
  return `${y + 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const ORG_KEYWORDS = [
  "บริษัท", "จำกัด", "หจก", "ห้างหุ้นส่วน", "โรงเรียน", "ร้าน", "คลินิก", "มูลนิธิ",
  "สมาคม", "มหาวิทยาลัย", "วิทยาลัย", "โรงพยาบาล", "สหกรณ์", "องค์การ", "หสม",
  "นิติบุคคล", "อาคารชุด", "โรงแรม", "co.,", "co.", "ltd", "logistics", "school",
  "company", "corporation", "enterprise", "group", "!nc", "inc.",
];
function customerType(name) {
  const lower = name.toLowerCase();
  return ORG_KEYWORDS.some((k) => lower.includes(k)) ? "organization" : "individual";
}

// Normalize the ~60 messy category spellings down to canonical names.
// Unknown/blank → Other, with the raw value preserved in the policy notes.
const CATEGORY_MAP = new Map(Object.entries({
  "motor": "Motor", "mortor": "Motor",
  "พรบ.รถ": "พรบ.รถ", "พรบ.": "พรบ.รถ", "พรบ": "พรบ.รถ",
  "พรบ.ปั้ม": "พรบ.ปั้ม", "พรบ.ปั๊ม": "พรบ.ปั้ม", "พรบปั๊ม": "พรบ.ปั้ม",
  "health": "Health", "opd": "Health",
  "health+life": "Health+Life", "health +life": "Health+Life", "health/life": "Health+Life",
  "life": "Life",
  "ta": "TA", "pa": "PA", "pl": "PL",
  "iar": "IAR", "iat": "IAR", "iar+pl": "IAR",
  "car": "CAR", "bi": "BI",
  "marine": "Marine", "marin": "Marine",
  "sme": "SME", "pack sme": "SME", "package sme": "SME", "packget sme": "SME",
  "golf": "Golf", "กอล์ฟ": "Golf",
  "fire": "Fire", "อัคคีภัย": "Fire",
  "บ้าน": "บ้าน", "package บ้าน": "บ้าน", "pack บ้าน": "บ้าน", "packget บ้าน": "บ้าน",
  "packget": "บ้าน", "ประกันบ้าน": "บ้าน", "บ้านแทนรัก": "บ้าน",
  "covid": "Covid", "corona": "Covid",
  "money": "ประกันเงิน", "ประกันเงิน": "ประกันเงิน", "ประกันภัยสำหรับเงิน": "ประกันเงิน", "ภัยสำหรับเงิน": "ประกันเงิน",
  "ซื่อสัตย์": "ซื่อสัตย์", "ความซื่อสัตย์": "ซื่อสัตย์", "ประกันซื่อสัตย์": "ซื่อสัตย์",
  "ประกันความซื่อสัตย์": "ซื่อสัตย์", "ซื่อสัตว์": "ซื่อสัตย์",
  "ความรับผิดวิชาชีพ": "วิชาชีพ", "ประกันวิชาชีพ": "วิชาชีพ",
  "สัตว์เลี้ยง": "สัตว์เลี้ยง",
}));
// Same 90-day follow-up window as Motor for new vehicle-adjacent categories;
// everything else gets the 120-day default. Manager can adjust in Settings.
const NEW_CATEGORY_DAYS = { "พรบ.ปั้ม": 90 };

function normalizeCategory(raw) {
  const cleaned = String(raw ?? "").trim();
  if (!cleaned) return { name: "Other", raw: null };
  const mapped = CATEGORY_MAP.get(cleaned.toLowerCase());
  if (mapped) return { name: mapped, raw: cleaned.toLowerCase() === mapped.toLowerCase() ? null : cleaned };
  return { name: "Other", raw: cleaned };
}

// ---- read workbook ----
const wb = XLSX.read(readFileSync(FILE), { cellDates: true });
const history = XLSX.utils.sheet_to_json(wb.Sheets["ประวัติกรมธรรม์ทั้งหมด"], { defval: null });

// ---- build customers ----
const customers = new Map(); // name -> { name, customer_type }
for (const r of history) {
  const name = String(r["ชื่อลูกค้า (กลุ่ม)"] ?? "").trim();
  if (!name || customers.has(name)) continue;
  customers.set(name, { name, phone: null, customer_type: customerType(name), owner_id: OWNER_ID });
}

// ---- build policies ----
const policies = [];
const categoryCounts = {};
for (const r of history) {
  const name = String(r["ชื่อลูกค้า (กลุ่ม)"] ?? "").trim();
  if (!name) continue;

  const { name: catName, raw: rawCat } = normalizeCategory(r["ประเภท"]);
  categoryCounts[catName] = (categoryCounts[catName] ?? 0) + 1;

  const start = toDateStr(r["วันที่เริ่มคุ้มครอง"]);
  const premium = r["เบี้ยประกัน"] == null ? null : Number(r["เบี้ยประกัน"]);
  const comRaw = r["ค่าคอม"] == null ? null : Number(r["ค่าคอม"]);
  // Rates arrive as fractions (0.18 = 18%). Anything ≥ 1 would be a data
  // error for a rate — treat as already-percent.
  const rate = comRaw == null ? null : comRaw < 1 ? Math.round(comRaw * 10000) / 100 : comRaw;
  const discRaw = r["ส่วนลด"] == null ? null : Number(r["ส่วนลด"]);
  const discount =
    discRaw == null ? 0 : discRaw < 1 && premium ? Math.round(discRaw * premium * 100) / 100 : discRaw;

  const plate = String(r["ทะเบียนรถ"] ?? "").trim();
  const policyNo = String(r["เลขที่กรมธรรม์"] ?? "").trim();
  const detailParts = [];
  if (plate) detailParts.push(`ทะเบียน ${plate}`);
  if (policyNo) detailParts.push(`กธ. ${policyNo}`);

  const noteParts = [];
  const agent = String(r["Agent"] ?? "").trim();
  if (agent) noteParts.push(`Agent: ${agent}`);
  if (rawCat) noteParts.push(`ประเภทเดิม: ${rawCat}`);
  const remark = String(r["หมายเหตุ"] ?? "").trim();
  if (remark) noteParts.push(remark);

  policies.push({
    customer_name: name,
    category_name: catName,
    insurance_company: String(r["บริษัทประกัน"] ?? "").trim() || null,
    policy_detail: detailParts.join(" · ") || null,
    coverage_start_date: start,
    coverage_end_date: plusOneYear(start),
    closed_date: start,
    deal_status: "win",
    net_premium: premium,
    company_commission_rate: rate,
    customer_discount_amount: discount,
    notes: noteParts.join(" | ") || null,
    reported_date: start ?? "2026-07-09",
  });
}

console.log(`customers: ${customers.size}`);
console.log(`policies: ${policies.length}`);
console.log(`categories used:`, JSON.stringify(categoryCounts));

if (DRY) {
  console.log("\n--- DRY RUN SAMPLES ---");
  console.log(JSON.stringify([...customers.values()].slice(0, 5), null, 1));
  console.log(JSON.stringify(policies.slice(0, 5), null, 1));
  process.exit(0);
}

// ---- resume support: reuse existing customers, continue policies from
// where the last (atomic, ordered, 500-row) batch left off ----
async function fetchAllCustomers() {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await rest("GET", `customers?select=id,name&order=created_at&offset=${offset}&limit=1000`);
    all.push(...page);
    if (page.length < 1000) break;
  }
  return all;
}

const existingCustomers = await fetchAllCustomers();
const resuming = existingCustomers.length > 0;
if (resuming && existingCustomers.length !== customers.size) {
  console.error(`ABORT: ${existingCustomers.length} customers in DB but file has ${customers.size} — mixed data, not resuming.`);
  process.exit(1);
}

// ---- ensure categories exist ----
const dbCategories = await rest("GET", "policy_categories?select=id,name");
const catIdByName = new Map(dbCategories.map((c) => [c.name, c.id]));
for (const catName of Object.keys(categoryCounts)) {
  if (!catIdByName.has(catName)) {
    const [created] = await rest(
      "POST",
      "policy_categories",
      [{ name: catName, renewal_reminder_days: NEW_CATEGORY_DAYS[catName] ?? 120 }],
      "return=representation",
    );
    catIdByName.set(catName, created.id);
    console.log(`created category: ${catName}`);
  }
}

// ---- insert customers in batches (or reuse when resuming) ----
const customerIdByName = new Map();
if (resuming) {
  for (const c of existingCustomers) customerIdByName.set(c.name, c.id);
  console.log(`resuming: reusing ${customerIdByName.size} existing customers`);
} else {
  const customerRows = [...customers.values()];
  for (let i = 0; i < customerRows.length; i += 500) {
    const batch = customerRows.slice(i, i + 500);
    const inserted = await rest("POST", "customers", batch, "return=representation");
    for (const c of inserted) customerIdByName.set(c.name, c.id);
    console.log(`customers inserted: ${Math.min(i + 500, customerRows.length)}/${customerRows.length}`);
  }
}

// ---- insert policies in batches ----
const policyRows = policies.map((p) => ({
  customer_id: customerIdByName.get(p.customer_name),
  category_id: catIdByName.get(p.category_name),
  insurance_company: p.insurance_company,
  policy_detail: p.policy_detail,
  coverage_start_date: p.coverage_start_date,
  coverage_end_date: p.coverage_end_date,
  closed_date: p.closed_date,
  deal_status: p.deal_status,
  net_premium: p.net_premium,
  company_commission_rate: p.company_commission_rate,
  customer_discount_amount: p.customer_discount_amount,
  notes: p.notes,
  reported_date: p.reported_date,
}));
// Batches are atomic and inserted in file order, so the existing row count
// is exactly where the previous run stopped.
const countRes = await fetch(`${URL}/rest/v1/policies?select=id`, {
  method: "HEAD",
  headers: { ...HEADERS, Prefer: "count=exact" },
});
const startAt = Number(countRes.headers.get("content-range")?.split("/")[1] ?? 0);
if (startAt > 0) console.log(`resuming policies from row ${startAt}`);

for (let i = startAt; i < policyRows.length; i += 500) {
  const batch = policyRows.slice(i, i + 500);
  await rest("POST", "policies", batch);
  console.log(`policies inserted: ${Math.min(i + 500, policyRows.length)}/${policyRows.length}`);
}

console.log("IMPORT COMPLETE");
