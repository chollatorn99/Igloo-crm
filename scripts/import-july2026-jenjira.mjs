// One-off: reload Jenjira's July 2026 sales from the authoritative Igloo Broker
// "INSURANCE CHECK 2025-2026" workbook (sheet July_26). Clears Jenjira's
// existing July 2026 win policies first, then inserts the file's rows (premium
// > 0) as Win under Jenjira. Also removes the IAR "อีฟ พาวเวอร์" row that was
// mis-entered under Chanpimook (motor-only). DRY=1 to preview.
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const FILE = "D:/IglooBroker/Igloo Broker/Igloo Broker - Documents/Reports/Report -igloo broker/INSURANCE CHECK 2025-2026.xlsx";
const JEN = "984585f3-52e3-4283-8139-00bdd2362e19";  // Jenjira
const CH  = "3275c3e2-2c5e-4787-abba-54c10df39127";  // Chanpimook
const DRY = process.env.DRY === "1";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const envGet = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] || "").trim();
const SUPA_URL = envGet("NEXT_PUBLIC_SUPABASE_URL");
const KEY = envGet("SUPABASE_SERVICE_ROLE_KEY");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const rest = async (m, p, b, prefer) => {
  const r = await fetch(`${SUPA_URL}/rest/v1/${p}`, { method: m, headers: { ...H, ...(prefer ? { Prefer: prefer } : {}) }, body: b ? JSON.stringify(b) : undefined });
  if (!r.ok) throw new Error(`${m} ${p} -> ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
};

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
function baseName(full) {
  let s = norm(full);
  let cut = s.length;
  for (const d of [" -", " /", "ทะเบียน", "แจ้ง", "จำนวน", " เข้า", " ออก", "จำนวน"]) {
    const i = s.indexOf(d); if (i > 3 && i < cut) cut = i;
  }
  return s.slice(0, cut).trim();
}
function dmyDates(v) {
  if (v instanceof Date) { const d = new Date(v.getTime() + 7 * 3600e3); return [d.toISOString().slice(0, 10)]; }
  const out = []; const re = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g; let m;
  while ((m = re.exec(String(v ?? "")))) out.push(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
  return out;
}
function plusOneYear(d) { if (!d) return null; const [y, m, dd] = d.split("-").map(Number); const day = m === 2 && dd === 29 ? 28 : dd; return `${y + 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`; }

const CATMAP = new Map(Object.entries({
  "motor": "Motor", "พรบ.รถ": "พรบ.รถ", "พรบ.": "พรบ.รถ", "พรบ": "พรบ.รถ",
  "พรบ.ปั้ม": "พรบ.ปั้ม", "พรบ.ปั๊ม": "พรบ.ปั้ม", "ta": "TA", "pa": "PA", "pl": "PL",
  "iar": "IAR", "car": "CAR", "health+life": "Health+Life", "health": "Health",
  "life": "Life", "บ้าน": "บ้าน", "กอล์ฟ": "Golf", "golf": "Golf", "fire": "Fire",
}));
const normCat = (raw) => {
  const c = norm(raw).replace(/บ้้าน/g, "บ้าน");
  return CATMAP.get(c.toLowerCase()) || (c || "Other");
};
const ORG = ["บริษัท", "จำกัด", "หจก", "ห้างหุ้นส่วน", "โรงเรียน", "นิติบุคคล", "อาคารชุด", "มหาชน", "สหกรณ์"];
const custType = (n) => ORG.some((k) => n.includes(k)) ? "organization" : "individual";

// ---- parse sheet ----
const wb = XLSX.read(readFileSync(FILE), { cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets["July_26"], { defval: null, header: 1 });
const recs = [];
for (let i = 5; i < rows.length; i++) {
  const r = rows[i]; if (!r) continue;
  const name = norm(r[2]); if (!name || /^รวม/.test(name)) continue;
  const prem = r[9] == null ? 0 : Number(r[9]); if (!(prem > 0)) continue;
  const dts = dmyDates(r[5]);
  const start = dts[0] || dmyDates(r[1])[0] || null;
  const end = dts[1] || plusOneYear(start);
  const report = dmyDates(r[1])[0] || start;
  const comRaw = r[25] == null ? null : Number(r[25]);
  const rate = comRaw == null ? null : (comRaw < 1 ? Math.round(comRaw * 10000) / 100 : comRaw);
  const disc = [r[18], r[15]].map((x) => (x == null ? null : Number(x))).find((x) => x != null) ?? 0;
  const wht1 = r[17] != null && Number(r[17]) > 0;
  const base = baseName(name);
  const suffix = norm(name).slice(base.length).replace(/^[\s/\-]+/, "").trim();
  const policyNo = norm(r[6]);
  const detail = [suffix, policyNo && `กธ. ${policyNo}`].filter(Boolean).join(" · ") || null;
  const agent = norm(r[24]);
  recs.push({
    base, fullName: name, category: normCat(r[4]), insurer: norm(r[3]) || null,
    net_premium: prem, stamp_duty: r[10] == null ? 0 : Number(r[10]), vat: r[12] == null ? 0 : Number(r[12]),
    company_commission_rate: rate, customer_discount_amount: disc, withholding_tax_1pct: wht1,
    coverage_start_date: start, coverage_end_date: end, closed_date: report, reported_date: report,
    policy_detail: detail, notes: agent ? `Agent: ${agent}` : null,
  });
}
const total = recs.reduce((s, r) => s + r.net_premium, 0);
console.log(`ไฟล์: ${recs.length} รายการมีเบี้ย · รวม ${total.toLocaleString()}`);

// ---- match customers to existing Jenjira customers ----
const jenCusts = [];
for (let o = 0; ; o += 1000) { const p = await rest("GET", `customers?select=id,name&owner_id=eq.${JEN}&offset=${o}&limit=1000`); jenCusts.push(...p); if (p.length < 1000) break; }
const jc = jenCusts.map((c) => ({ id: c.id, n: norm(c.name) }));
const findCust = (base) => {
  let exact = jc.find((c) => c.n === base); if (exact) return { id: exact.id, how: "exact" };
  if (base.length >= 6) {
    const pre = jc.filter((c) => c.n.startsWith(base + " ") || base.startsWith(c.n + " ")).sort((a, b) => a.n.length - b.n.length)[0];
    if (pre) return { id: pre.id, how: "prefix:" + pre.n.slice(0, 24) };
  }
  return null;
};
let matched = 0, toCreate = new Map();
for (const r of recs) {
  const f = findCust(r.base);
  if (f) { r._cid = f.id; matched++; }
  else { if (!toCreate.has(r.base)) toCreate.set(r.base, null); r._new = true; }
}
console.log(`ลูกค้า: match เดิม ${matched} · สร้างใหม่ ${toCreate.size} ราย`);

if (DRY) {
  console.log("\nตัวอย่าง 10 แถว:");
  recs.slice(0, 10).forEach((r) => console.log(`  ${r.closed_date} | ${r.insurer}/${r.category} | เบี้ย ${r.net_premium} | ${r._new ? "NEW" : "match"} | ${r.base.slice(0, 30)}`));
  console.log("\nสร้างลูกค้าใหม่ (base name):"); [...toCreate.keys()].slice(0, 20).forEach((n) => console.log("  + " + n));
  process.exit(0);
}

// ===== EXECUTE =====
// 1) delete Jenjira's existing July 2026 win policies
const oldJul = await rest("GET", `policies?select=id,customers!inner(owner_id)&customers.owner_id=eq.${JEN}&deal_status=eq.win&closed_date=gte.2026-07-01&closed_date=lte.2026-07-31`);
for (const p of oldJul) await rest("DELETE", `policies?id=eq.${p.id}`, undefined, "return=minimal");
console.log(`ลบ ก.ค. เดิมของ Jenjira: ${oldJul.length} รายการ`);

// 2) remove IAR "อีฟ พาวเวอร์" mis-entered under Chanpimook
const misEntry = await rest("GET", `policies?select=id,category:policy_categories(name),customer:customers!inner(id,name,owner_id)&customers.owner_id=eq.${CH}&customers.name=ilike.*อีฟ พาวเวอร์*`);
for (const p of misEntry) if (p.category?.name === "IAR") { await rest("DELETE", `policies?id=eq.${p.id}`, undefined, "return=minimal"); console.log(`ลบ IAR อีฟ พาวเวอร์ (Chanpimook mis-entry): ${p.id.slice(0,8)}`); }

// 3) categories: ensure they exist
const dbCats = await rest("GET", "policy_categories?select=id,name");
const catId = new Map(dbCats.map((c) => [c.name, c.id]));
for (const nm of new Set(recs.map((r) => r.category))) if (!catId.has(nm)) { const [c] = await rest("POST", "policy_categories", [{ name: nm, renewal_reminder_days: 120 }], "return=representation"); catId.set(nm, c.id); console.log("created category " + nm); }

// 4) create the new customers, map base -> id
for (const base of toCreate.keys()) {
  const [c] = await rest("POST", "customers", [{ name: base, phone: null, customer_type: custType(base), owner_id: JEN }], "return=representation");
  toCreate.set(base, c.id);
}
console.log(`สร้างลูกค้าใหม่: ${toCreate.size} ราย`);

// 5) insert policies
const payload = recs.map((r) => ({
  customer_id: r._cid || toCreate.get(r.base),
  category_id: catId.get(r.category),
  insurance_company: r.insurer, policy_detail: r.policy_detail,
  coverage_start_date: r.coverage_start_date, coverage_end_date: r.coverage_end_date,
  closed_date: r.closed_date, reported_date: r.reported_date, deal_status: "win",
  net_premium: r.net_premium, stamp_duty: r.stamp_duty, vat: r.vat,
  company_commission_rate: r.company_commission_rate, customer_discount_amount: r.customer_discount_amount,
  withholding_tax_1pct: r.withholding_tax_1pct, notes: r.notes,
}));
for (let i = 0; i < payload.length; i += 200) await rest("POST", "policies", payload.slice(i, i + 200));
console.log(`ลงกรมธรรม์ใหม่: ${payload.length} รายการ · รวมเบี้ย ${total.toLocaleString()}`);
console.log("DONE");
