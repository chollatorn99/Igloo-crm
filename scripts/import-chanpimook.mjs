// Import Chanpimook's (motor@igloobroker) customer/policy history from the
// "ประวัติกรมธรรม์ทั้งหมด" sheet of her BRG_Group follow-up file into Supabase.
// Multi-owner safe: dedups customers and resumes policies scoped to Chanpimook
// only, so it never touches Jenjira's already-imported data.
// Usage: node scripts/import-chanpimook.mjs "<file.xlsx>"   (DRY=1 for preview)
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const FILE = process.argv[2];
const OWNER_ID = "3275c3e2-2c5e-4787-abba-54c10df39127"; // Chanpimook Janpen

// Read Supabase creds from crm/.env.local so the script is self-contained.
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const envGet = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] || "").trim();
const SUPA_URL = process.env.SUPABASE_URL || envGet("NEXT_PUBLIC_SUPABASE_URL");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envGet("SUPABASE_SERVICE_ROLE_KEY");
const DRY = process.env.DRY === "1";

const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function rest(method, path, body, prefer) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method,
    headers: { ...HEADERS, ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

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
  const day = m === 2 && d === 29 ? 28 : d;
  return `${y + 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const ORG_KEYWORDS = [
  "บริษัท", "จำกัด", "หจก", "ห้างหุ้นส่วน", "โรงเรียน", "ร้าน", "คลินิก", "มูลนิธิ",
  "สมาคม", "มหาวิทยาลัย", "วิทยาลัย", "โรงพยาบาล", "สหกรณ์", "องค์การ", "หสม",
  "นิติบุคคล", "อาคารชุด", "โรงแรม", "co.,", "co.", "ltd", "logistics", "school",
  "company", "corporation", "enterprise", "group", "!nc", "inc.",
];
const customerType = (name) =>
  ORG_KEYWORDS.some((k) => name.toLowerCase().includes(k)) ? "organization" : "individual";

const CATEGORY_MAP = new Map(Object.entries({
  "motor": "Motor", "mortor": "Motor",
  "พรบ.รถ": "พรบ.รถ", "พรบ.": "พรบ.รถ", "พรบ": "พรบ.รถ", "พ.ร.บ.": "พรบ.รถ", "พ.ร.บ": "พรบ.รถ",
  "health": "Health", "opd": "Health",
  "health+life": "Health+Life", "health +life": "Health+Life", "health/life": "Health+Life",
  "life": "Life", "ta": "TA", "pa": "PA", "pl": "PL",
  "iar": "IAR", "iat": "IAR", "iar+pl": "IAR", "car": "CAR", "bi": "BI",
  "marine": "Marine", "marin": "Marine",
  "golf": "Golf", "กอล์ฟ": "Golf", "fire": "Fire", "อัคคีภัย": "Fire",
  "บ้าน": "บ้าน", "ประกันบ้าน": "บ้าน", "covid": "Covid",
}));

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

// ---- build customers (unique by name, scoped to this owner) ----
const customers = new Map();
for (const r of history) {
  const name = String(r["ชื่อลูกค้า (กลุ่ม)"] ?? "").trim();
  if (!name || customers.has(name)) continue;
  customers.set(name, { name, phone: null, customer_type: customerType(name), owner_id: OWNER_ID });
}

// ---- build policies ----
const policies = [];
const categoryCounts = {};
let premiumSum = 0;
for (const r of history) {
  const name = String(r["ชื่อลูกค้า (กลุ่ม)"] ?? "").trim();
  if (!name) continue;

  const { name: catName, raw: rawCat } = normalizeCategory(r["ประเภท"]);
  categoryCounts[catName] = (categoryCounts[catName] ?? 0) + 1;

  const start = toDateStr(r["วันที่เริ่มคุ้มครอง"]);
  const end = toDateStr(r["วันหมดอายุ"]) ?? plusOneYear(start);
  const reported = toDateStr(r["วันที่แจ้งงาน"]) ?? start;
  const premium = r["เบี้ยประกัน"] == null ? null : Number(r["เบี้ยประกัน"]);
  if (premium) premiumSum += premium;
  const discRaw = r["ส่วนลด"] == null ? null : Number(r["ส่วนลด"]);
  const discount = discRaw == null ? 0 : discRaw < 1 && premium ? Math.round(discRaw * premium * 100) / 100 : discRaw;

  // Vehicle/asset info lives on the policy (customers stay one clean name).
  const brandModel = [String(r["แบรนด์"] ?? "").trim(), String(r["รุ่นรถ"] ?? "").trim()].filter(Boolean).join(" ");
  const plate = String(r["ทะเบียนรถ"] ?? "").trim();
  const policyNo = String(r["เลขที่กรมธรรม์"] ?? "").trim();
  const detailParts = [];
  if (brandModel) detailParts.push(brandModel);
  if (plate) detailParts.push(`ทะเบียน ${plate}`);
  if (policyNo) detailParts.push(`กธ. ${policyNo}`);

  const noteParts = [];
  const reporter = String(r["ผู้แจ้งงาน"] ?? "").trim();
  if (reporter) noteParts.push(`ผู้แจ้งงาน: ${reporter}`);
  if (rawCat) noteParts.push(`ประเภทเดิม: ${rawCat}`);
  const remark = String(r["หมายเหตุ"] ?? "").trim();
  if (remark) noteParts.push(remark);

  policies.push({
    customer_name: name,
    category_name: catName,
    insurance_company: String(r["บริษัทประกัน"] ?? "").trim() || null,
    policy_detail: detailParts.join(" · ") || null,
    coverage_start_date: start,
    coverage_end_date: end,
    closed_date: reported,
    deal_status: "win",
    net_premium: premium,
    customer_discount_amount: discount,
    notes: noteParts.join(" | ") || null,
    reported_date: reported ?? new Date().toISOString().slice(0, 10),
  });
}

console.log(`OWNER: Chanpimook (${OWNER_ID})`);
console.log(`customers (unique names): ${customers.size}`);
console.log(`policies: ${policies.length}`);
console.log(`premium sum: ${premiumSum.toLocaleString()}`);
console.log(`categories:`, JSON.stringify(categoryCounts));

if (DRY) {
  console.log("\n--- DRY RUN SAMPLES ---");
  console.log(JSON.stringify([...customers.values()].slice(0, 3), null, 1));
  console.log(JSON.stringify(policies.slice(0, 4), null, 1));
  process.exit(0);
}

// ---- resume support scoped to THIS owner ----
async function fetchOwnerCustomers() {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await rest("GET", `customers?select=id,name&owner_id=eq.${OWNER_ID}&order=created_at&offset=${offset}&limit=1000`);
    all.push(...page);
    if (page.length < 1000) break;
  }
  return all;
}
const existing = await fetchOwnerCustomers();
const resuming = existing.length > 0;
if (resuming && existing.length !== customers.size) {
  console.error(`ABORT: ${existing.length} Chanpimook customers in DB but file has ${customers.size} — check before resuming.`);
  process.exit(1);
}

// ---- ensure categories exist ----
const dbCategories = await rest("GET", "policy_categories?select=id,name");
const catIdByName = new Map(dbCategories.map((c) => [c.name, c.id]));
for (const catName of Object.keys(categoryCounts)) {
  if (!catIdByName.has(catName)) {
    const [created] = await rest("POST", "policy_categories", [{ name: catName, renewal_reminder_days: 120 }], "return=representation");
    catIdByName.set(catName, created.id);
    console.log(`created category: ${catName}`);
  }
}

// ---- customers (reuse when resuming) ----
const customerIdByName = new Map();
if (resuming) {
  for (const c of existing) customerIdByName.set(c.name, c.id);
  console.log(`resuming: reusing ${customerIdByName.size} existing Chanpimook customers`);
} else {
  const rows = [...customers.values()];
  for (let i = 0; i < rows.length; i += 500) {
    const inserted = await rest("POST", "customers", rows.slice(i, i + 500), "return=representation");
    for (const c of inserted) customerIdByName.set(c.name, c.id);
    console.log(`customers inserted: ${Math.min(i + 500, rows.length)}/${rows.length}`);
  }
}

// ---- policies (resume from Chanpimook's current policy count) ----
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
  customer_discount_amount: p.customer_discount_amount,
  notes: p.notes,
  reported_date: p.reported_date,
}));
const countRes = await fetch(`${SUPA_URL}/rest/v1/policies?select=id,customers!inner(owner_id)&customers.owner_id=eq.${OWNER_ID}`, {
  method: "HEAD",
  headers: { ...HEADERS, Prefer: "count=exact" },
});
const startAt = Number(countRes.headers.get("content-range")?.split("/")[1] ?? 0);
if (startAt > 0) console.log(`resuming policies from row ${startAt}`);
for (let i = startAt; i < policyRows.length; i += 500) {
  await rest("POST", "policies", policyRows.slice(i, i + 500));
  console.log(`policies inserted: ${Math.min(i + 500, policyRows.length)}/${policyRows.length}`);
}

console.log("IMPORT COMPLETE");
