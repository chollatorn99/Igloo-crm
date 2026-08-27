// One-off: reload Chanpimook's July 2026 sales from her "INSURENACE CHEK" file
// (sheet 07.26). These are motor renewals with no report-date column, so all
// are counted on 2026-07-31 (per owner's instruction). Clears Chanpimook's
// existing July 2026 win policies first, then inserts. DRY=1 to preview.
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const FILE = "C:/Users/UnGy/OneDrive/Documents/INSURENACE CHEK เดือน 1-7.xlsx";
const SHEET = "07.26";
const CLOSED = "2026-07-31";
const CH = "3275c3e2-2c5e-4787-abba-54c10df39127"; // Chanpimook
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
const strip = (s) => s.replace(/\s/g, "");
function covDate(v) {
  if (v instanceof Date) return new Date(v.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
  const m = String(v ?? "").match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (!m) return null;
  const yy = m[3].length === 2 ? "20" + m[3] : m[3];
  return `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
const plusOneYear = (d) => { if (!d) return null; const [y, m, dd] = d.split("-").map(Number); const day = m === 2 && dd === 29 ? 28 : dd; return `${y + 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`; };
const CATMAP = new Map(Object.entries({ "motor": "Motor", "พรบ.": "พรบ.รถ", "พรบ.รถ": "พรบ.รถ", "พรบ": "พรบ.รถ", "พรบ.ปั้ม": "พรบ.ปั้ม", "pa": "PA", "iar": "IAR", "ta": "TA", "car": "CAR" }));
const normCat = (raw) => { const c = norm(raw); return CATMAP.get(c.toLowerCase()) || (c || "Other"); };
const ORG = ["บริษัท", "จำกัด", "หจก", "ห้างหุ้นส่วน", "นิติบุคคล", "มหาชน", "โรงเรียน"];
const custType = (n) => ORG.some((k) => n.includes(k)) ? "organization" : "individual";

// ---- parse ----
const wb = XLSX.read(readFileSync(FILE), { cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { defval: null, header: 1 });
const recs = [];
for (let i = 4; i < rows.length; i++) {
  const r = rows[i]; if (!r) continue;
  const name = norm(r[2]); if (!name || /^รวม|สรุป/.test(name)) continue;
  const prem = r[7] == null ? 0 : Number(r[7]); if (!(prem > 0)) continue;
  const start = covDate(r[6]);
  const brand = norm(r[1]);
  const model = norm(r[3]);
  const wht1 = (r[12] != null && Number(r[12]) === 1) || (r[13] != null && Number(r[13]) > 0);
  recs.push({
    name, base: name, category: normCat(r[4]), insurer: norm(r[5]) || null,
    net_premium: prem, stamp_duty: r[8] == null ? 0 : Number(r[8]), vat: r[10] == null ? 0 : Number(r[10]),
    customer_discount_amount: r[14] == null ? 0 : Number(r[14]), withholding_tax_1pct: wht1,
    coverage_start_date: start, coverage_end_date: plusOneYear(start),
    closed_date: CLOSED, reported_date: CLOSED,
    policy_detail: [brand, model].filter(Boolean).join(" ") || null,
    notes: "งานต่ออายุ (motor)" + (brand ? ` · ${brand}` : ""),
  });
}
const total = recs.reduce((s, r) => s + r.net_premium, 0);
console.log(`ไฟล์: ${recs.length} บรรทัดมีเบี้ย · รวม ${total.toLocaleString()} (ควรตรง 861,113.25)`);

// ---- match customers (Chanpimook) ----
const chCusts = [];
for (let o = 0; ; o += 1000) { const p = await rest("GET", `customers?select=id,name&owner_id=eq.${CH}&offset=${o}&limit=1000`); chCusts.push(...p); if (p.length < 1000) break; }
const jc = chCusts.map((c) => ({ id: c.id, n: norm(c.name), s: strip(norm(c.name)) }));
const findCust = (base) => {
  const bs = strip(base);
  let e = jc.find((c) => c.n === base || c.s === bs); if (e) return e.id;
  if (base.length >= 6) { const pre = jc.filter((c) => c.s.startsWith(bs) || bs.startsWith(c.s)).sort((a, b) => a.n.length - b.n.length)[0]; if (pre) return pre.id; }
  return null;
};
let matched = 0; const toCreate = new Map();
for (const r of recs) { const id = findCust(r.base); if (id) { r._cid = id; matched++; } else toCreate.set(r.base, null); }
console.log(`ลูกค้า: match เดิม ${matched} · สร้างใหม่ ${toCreate.size}`);

if (DRY) {
  console.log("\nตัวอย่าง 10:");
  recs.slice(0, 10).forEach((r) => console.log(`  ${r.insurer}/${r.category} | เบี้ย ${r.net_premium} | cov ${r.coverage_start_date} | ${r._cid ? "match" : "NEW"} | ${r.name} [${r.policy_detail}]`));
  console.log("\nสร้างใหม่:", [...toCreate.keys()].join(" · "));
  process.exit(0);
}

// ===== EXECUTE =====
const oldJul = await rest("GET", `policies?select=id,customers!inner(owner_id)&customers.owner_id=eq.${CH}&deal_status=eq.win&closed_date=gte.2026-07-01&closed_date=lte.2026-07-31`);
for (const p of oldJul) await rest("DELETE", `policies?id=eq.${p.id}`, undefined, "return=minimal");
console.log(`ลบ ก.ค. เดิมของ Chanpimook: ${oldJul.length} รายการ`);

const dbCats = await rest("GET", "policy_categories?select=id,name");
const catId = new Map(dbCats.map((c) => [c.name, c.id]));
for (const nm of new Set(recs.map((r) => r.category))) if (!catId.has(nm)) { const [c] = await rest("POST", "policy_categories", [{ name: nm, renewal_reminder_days: 90 }], "return=representation"); catId.set(nm, c.id); console.log("created category " + nm); }

for (const base of toCreate.keys()) { const [c] = await rest("POST", "customers", [{ name: base, phone: null, customer_type: custType(base), owner_id: CH }], "return=representation"); toCreate.set(base, c.id); }
console.log(`สร้างลูกค้าใหม่: ${toCreate.size}`);

const payload = recs.map((r) => ({
  customer_id: r._cid || toCreate.get(r.base), category_id: catId.get(r.category),
  insurance_company: r.insurer, policy_detail: r.policy_detail,
  coverage_start_date: r.coverage_start_date, coverage_end_date: r.coverage_end_date,
  closed_date: r.closed_date, reported_date: r.reported_date, deal_status: "win",
  net_premium: r.net_premium, stamp_duty: r.stamp_duty, vat: r.vat,
  customer_discount_amount: r.customer_discount_amount, withholding_tax_1pct: r.withholding_tax_1pct, notes: r.notes,
}));
for (let i = 0; i < payload.length; i += 200) await rest("POST", "policies", payload.slice(i, i + 200));
console.log(`ลงกรมธรรม์: ${payload.length} · รวมเบี้ย ${total.toLocaleString()}`);
console.log("DONE");
