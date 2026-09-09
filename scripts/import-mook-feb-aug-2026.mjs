// Load Chanpimook's Feb-Aug 2026 sales report (INSURENACE CHEK 02-08) + the
// Sheet1 Chery real sales. Clears her existing non-prospect win policies for
// those months first, then reloads. Report months without a วันแจ้งงาน column
// are all counted on the month's last day (per owner's instruction). Commission
// Motor 18% / พรบ.รถ 12%. DRY=1 previews.
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const FILE = "C:/Users/UnGy/OneDrive/Documents/INSURENACE CHEK เดือน 02-08 . 2026.xlsx";
const CH = "3275c3e2-2c5e-4787-abba-54c10df39127"; // Chanpimook
const DRY = process.env.DRY === "1";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const eg = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] || "").trim();
const SUPA_URL = eg("NEXT_PUBLIC_SUPABASE_URL"), KEY = eg("SUPABASE_SERVICE_ROLE_KEY");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const rest = async (m, p, b, prefer) => {
  const r = await fetch(`${SUPA_URL}/rest/v1/${p}`, { method: m, headers: { ...H, ...(prefer ? { Prefer: prefer } : {}) }, body: b ? JSON.stringify(b) : undefined });
  if (!r.ok) throw new Error(`${m} ${p} -> ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
};
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const strip = (s) => norm(s).replace(/\s/g, "");
const isDate = (v) => v instanceof Date || /^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}$/.test(String(v ?? "").trim());
const num = (v) => { if (v == null || v === "-") return null; const n = Number(String(v).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
const lastDay = (mm) => { const d = new Date(2026, mm, 0); return `2026-${String(mm).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const parseDMY = (v) => {
  if (v instanceof Date) { const s = new Date(Math.round((v.getTime() + 7 * 3600e3) / 86400e3) * 86400e3); return s.toISOString().slice(0, 10); }
  const m = String(v ?? "").match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/); if (!m) return null;
  const yy = m[3].length === 2 ? "20" + m[3] : m[3];
  return `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};
const plusYear = (d) => { if (!d) return null; const [y, m, dd] = d.split("-").map(Number); const day = m === 2 && dd === 29 ? 28 : dd; return `${y + 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`; };
const catOf = (raw) => /พรบ|พ\.?ร\.?บ/.test(norm(raw)) ? "พรบ.รถ" : "Motor";
const ORG = ["บริษัท", "บจก", "หจก", "ห้างหุ้นส่วน", "จำกัด", "มหาชน", "โรงเรียน"];
const custType = (n) => ORG.some((k) => n.includes(k)) ? "organization" : "individual";
const COMM = { "Motor": 18, "พรบ.รถ": 12 };

const wb = XLSX.read(readFileSync(FILE), { cellDates: true });
const recs = [];
for (const sn of ["02.26", "03.26", "04.26", "05.26", "06.26", "07.26", "08.26"]) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: null, header: 1 });
  const hi = rows.findIndex((r) => r && r.some((c) => norm(c) === "ชื่อลูกค้า"));
  const hdr = rows[hi].map(norm);
  const cix = (name) => hdr.findIndex((h) => h === name);
  const brandC = cix("อ้างอิง"), nameC = cix("ชื่อลูกค้า"), modelC = cix("รุ่นรถ"),
    catC = cix("ประเภท"), insC = cix("ประกันภัย"), repC = cix("วันแจ้งงาน");
  const mm = Number(sn.slice(0, 2));
  let lastName = null;
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    let p = insC + 1, cov = null;
    if (isDate(r[p])) { cov = r[p]; p++; }
    const net = num(r[p]); if (!(net > 0)) continue;
    const nm = norm(r[nameC]); if (nm) lastName = nm;
    const name = nm || lastName; if (!name) continue;
    const cat = catOf(r[catC]);
    const start = cov ? parseDMY(cov) : null;
    recs.push({
      month: sn, base: name, brand: norm(r[brandC]), model: norm(r[modelC]),
      category: cat, insurer: norm(r[insC]) || null,
      net_premium: net, stamp_duty: num(r[p + 1]) ?? 0, vat: num(r[p + 3]) ?? 0,
      coverage_start_date: start, coverage_end_date: plusYear(start),
      closed_date: repC >= 0 && r[repC] ? parseDMY(r[repC]) : lastDay(mm),
      company_commission_rate: COMM[cat],
      policy_detail: [norm(r[brandC]), norm(r[modelC])].filter(Boolean).join(" ") || null,
      notes: `งานต่ออายุ (motor) · report ${sn}` + (norm(r[brandC]) ? ` · ${norm(r[brandC])}` : ""),
    });
  }
}
// Sheet1 = Chery real sales (Aug). cols: 1=วันแจ้งงาน,2=อ้างอิง,3=ชื่อ,4=รุ่น,5=ประเภท,6=ประกันภัย,7=คุ้มครอง,8=เบี้ยสุทธิ
{
  const rows = XLSX.utils.sheet_to_json(wb.Sheets["Sheet1"], { defval: null, header: 1 });
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue; const net = num(r[8]); if (!(net > 0)) continue;
    const name = norm(r[3]); if (!name) continue;
    const cat = catOf(r[5]);
    const start = parseDMY(r[7]);
    recs.push({
      month: "Sheet1", base: name, brand: "CHERY", model: norm(r[4]),
      category: cat, insurer: norm(r[6]) || null,
      net_premium: net, stamp_duty: 0, vat: 0,
      coverage_start_date: start, coverage_end_date: plusYear(start),
      closed_date: parseDMY(r[1]) || lastDay(8),
      company_commission_rate: COMM[cat],
      policy_detail: ["CHERY", norm(r[4])].filter(Boolean).join(" ") || null,
      notes: `ขายจริง Chery · report ส.ค. 2026`,
    });
  }
}

const byMonth = {}; recs.forEach((r) => { byMonth[r.month] = byMonth[r.month] || { n: 0, s: 0 }; byMonth[r.month].n++; byMonth[r.month].s += r.net_premium; });
console.log("เดือน | กรมธรรม์ | เบี้ยสุทธิ");
for (const m of Object.keys(byMonth)) console.log(`${m} | ${byMonth[m].n} | ${byMonth[m].s.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
console.log(`รวม: ${recs.length} กรมธรรม์ · ${recs.reduce((a, r) => a + r.net_premium, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);

// match customers (Chanpimook, non-prospect preferred but any of hers)
const chCusts = [];
for (let o = 0; ; o += 1000) { const pg = await rest("GET", `customers?select=id,name,is_prospect&owner_id=eq.${CH}&offset=${o}&limit=1000`); chCusts.push(...pg); if (pg.length < 1000) break; }
const jc = chCusts.map((c) => ({ id: c.id, n: norm(c.name), s: strip(c.name), pro: c.is_prospect }));
const findCust = (base) => {
  const bs = strip(base);
  // prefer a non-prospect exact match, then any exact, then prefix
  let e = jc.find((c) => !c.pro && (c.n === base || c.s === bs)) || jc.find((c) => c.n === base || c.s === bs);
  if (e) return e.id;
  if (base.length >= 6) { const pre = jc.filter((c) => !c.pro && (c.s.startsWith(bs) || bs.startsWith(c.s))).sort((a, b) => a.n.length - b.n.length)[0]; if (pre) return pre.id; }
  return null;
};
let matched = 0; const toCreate = new Map();
for (const r of recs) { const id = findCust(r.base); if (id) { r._cid = id; matched++; } else if (!toCreate.has(r.base)) toCreate.set(r.base, null); }
console.log(`\nลูกค้า: match เดิม ${matched} · สร้างใหม่ ${toCreate.size}`);

if (DRY) { console.log("\nตัวอย่าง:", recs.slice(0, 5).map((r) => `${r.month}/${r.category} ${r.net_premium} [${r.base.slice(0, 16)}] ${r._cid ? "match" : "NEW"}`).join(" | ")); process.exit(0); }

// ===== EXECUTE =====
// 1) clear existing non-prospect win policies for Feb-Aug 2026
const oldIds = [];
for (let o = 0; ; o += 1000) {
  const pg = await rest("GET", `policies?select=id,customer:customers!inner(owner_id)&customers.owner_id=eq.${CH}&deal_status=eq.win&is_prospect=eq.false&closed_date=gte.2026-02-01&closed_date=lte.2026-08-31&offset=${o}&limit=1000`);
  oldIds.push(...pg.map((x) => x.id)); if (pg.length < 1000) break;
}
for (let i = 0; i < oldIds.length; i += 100) await rest("DELETE", `policies?id=in.(${oldIds.slice(i, i + 100).join(",")})`, undefined, "return=minimal");
console.log(`ลบของเก่า ก.พ.-ส.ค.: ${oldIds.length} รายการ`);

// 2) categories + new customers
const dbCats = await rest("GET", "policy_categories?select=id,name");
const catId = new Map(dbCats.map((c) => [c.name, c.id]));
for (const nm of new Set(recs.map((r) => r.category))) if (!catId.has(nm)) { const [c] = await rest("POST", "policy_categories", [{ name: nm, renewal_reminder_days: 90 }], "return=representation"); catId.set(nm, c.id); }
for (const base of toCreate.keys()) { const [c] = await rest("POST", "customers", [{ name: base, phone: null, customer_type: custType(base), owner_id: CH, is_prospect: false }], "return=representation"); toCreate.set(base, c.id); }
console.log(`สร้างลูกค้าใหม่: ${toCreate.size}`);

// 3) insert policies
const payload = recs.map((r) => ({
  customer_id: r._cid || toCreate.get(r.base), category_id: catId.get(r.category),
  insurance_company: r.insurer, policy_detail: r.policy_detail,
  coverage_start_date: r.coverage_start_date, coverage_end_date: r.coverage_end_date,
  closed_date: r.closed_date, reported_date: r.closed_date, deal_status: "win",
  net_premium: r.net_premium, stamp_duty: r.stamp_duty, vat: r.vat,
  company_commission_rate: r.company_commission_rate, notes: r.notes,
}));
for (let i = 0; i < payload.length; i += 200) { await rest("POST", "policies", payload.slice(i, i + 200)); console.log(`policies inserted: ${Math.min(i + 200, payload.length)}/${payload.length}`); }
console.log("DONE · รวมเบี้ยสุทธิ " + recs.reduce((a, r) => a + r.net_premium, 0).toLocaleString(undefined, { maximumFractionDigits: 2 }));
