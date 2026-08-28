// Import dealer prospects (Kia / Deepal / BRG car buyers) as leads to chase for
// renewal. is_prospect=true (never counted as our sales). Owner = Chanpimook;
// 2025/2026 buyers stay Chanpimook-only, ≤2024 buyers are is_shared (both
// salespeople see them). Dedups against existing customers by phone + name.
// DRY=1 previews counts/dedup without writing.
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const DIR = "D:/Claude folder/Igloo/BRG and Dealer customers/";
const CH = "3275c3e2-2c5e-4787-abba-54c10df39127"; // Chanpimook (owner of all prospects)
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
const keyName = (s) => norm(s).replace(/\s/g, "").toLowerCase();
const normPhone = (v) => { let d = String(v ?? "").replace(/\D/g, ""); if (!d) return null; if (d.length === 9) d = "0" + d; return d; };
const dOnly = (v) => { if (v instanceof Date) return new Date(v.getTime() + 7 * 3600e3).toISOString().slice(0, 10); const m = String(v ?? "").match(/(\d{1,2})[-./](\d{1,2})[-./](\d{4})/); if (!m) return null; return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; };
const plusYears = (d, n) => { if (!d) return null; const [y, m, dd] = d.split("-").map(Number); const day = m === 2 && dd === 29 ? 28 : dd; return `${y + n}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`; };
const ORG = ["บริษัท", "จำกัด", "หจก", "บจก", "ห้างหุ้นส่วน", "นิติบุคคล", "มหาชน"];
const custType = (n) => ORG.some((k) => n.includes(k)) ? "organization" : "individual";

const prospects = [];
function push(rec) { if (rec.name && rec.name.length > 2) prospects.push(rec); }

// ---- Deepal ----
{
  const wb = XLSX.read(readFileSync(DIR + "Deepal รายชื่อประกันภัย 2024-2026.xlsx"), { cellDates: true });
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: null, header: 1 });
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const name = norm(r[1]); if (!name) continue;
      const sale = dOnly(r[16]);
      const freeM = String(r[14] ?? "").match(/(\d+)\s*year/i); const freeY = freeM ? Number(freeM[1]) : 1;
      const model = norm(r[11]) || norm(r[10]);
      const detail = ["DEEPAL", model, norm(r[12]), norm(r[8]) && `VIN ${norm(r[8])}`].filter(Boolean).join(" · ");
      push({ brand: "DEEPAL", name, phone: normPhone(r[2]), sale, expiry: plusYears(sale, freeY), detail, insurer: norm(r[15]) || null, freeY });
    }
  }
}
// ---- KIA ----
{
  const wb = XLSX.read(readFileSync(DIR + "ยอดปล่อย KIA July 24 to Aug 26.xlsx"), { cellDates: true });
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: null, header: 1 });
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r || !(typeof r[0] === "number")) continue; // skip subheaders
      const name = norm(r[2]); if (!name) continue;
      const sale = dOnly(r[1]);
      const detail = ["KIA", norm(r[4]), norm(r[7]), norm(r[5]) && `VIN ${norm(r[5])}`].filter(Boolean).join(" · ");
      push({ brand: "KIA", name, phone: normPhone(r[3]), sale, expiry: plusYears(sale, 1), detail, insurer: null, freeY: 1 });
    }
  }
}
// ---- BRG ----
{
  const wb = XLSX.read(readFileSync(DIR + "BRG 2022-July 2026.xlsx"), { cellDates: true });
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: null, header: 1 });
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const name = norm(r[1]); if (!name || !(typeof r[0] === "number")) continue;
      const sale = dOnly(r[3]);
      const detail = ["BRG (Toyota)", norm(r[2])].filter(Boolean).join(" · ");
      push({ brand: "BRG", name, phone: normPhone(r[4]), sale, expiry: plusYears(sale, 1), detail, insurer: null, freeY: 1 });
    }
  }
}

console.log(`อ่านจากไฟล์: ${prospects.length} ราย`);

// ---- dedup within import (by phone, else name) ----
const seen = new Set(); const uniq = [];
for (const p of prospects) {
  const k = p.phone ? "p:" + p.phone : "n:" + keyName(p.name);
  if (seen.has(k)) continue; seen.add(k); uniq.push(p);
}
console.log(`หลังตัดซ้ำในไฟล์เอง: ${uniq.length}`);

// ---- dedup against existing customers (phone + name) ----
const existing = [];
for (let o = 0; ; o += 1000) { const pg = await rest("GET", `customers?select=id,name,phone&offset=${o}&limit=1000`); existing.push(...pg); if (pg.length < 1000) break; }
const exPhones = new Set(existing.map((c) => normPhone(c.phone)).filter(Boolean));
const exNames = new Set(existing.map((c) => keyName(c.name)));
const fresh = [], dup = [];
for (const p of uniq) ((p.phone && exPhones.has(p.phone)) || exNames.has(keyName(p.name)) ? dup : fresh).push(p);

const yearOf = (p) => (p.sale ? Number(p.sale.slice(0, 4)) : 0);
const isShared = () => true; // all dealer prospects are shared (both salespeople chase them)
const chanOnly = fresh.filter((p) => !isShared(p)).length;
const shared = fresh.filter((p) => isShared(p)).length;
const byBrand = {}; fresh.forEach((p) => (byBrand[p.brand] = (byBrand[p.brand] || 0) + 1));
console.log(`\nซ้ำกับลูกค้าเดิม (ข้าม): ${dup.length}`);
console.log(`เพิ่มใหม่: ${fresh.length}  · แยกแบรนด์ ${JSON.stringify(byBrand)}`);
console.log(`  → ปี 2025-2026 (เฉพาะ Chanpimook): ${chanOnly}`);
console.log(`  → ปี ≤2024 (เห็นคู่ is_shared): ${shared}`);
console.log(`  ไม่มีเบอร์: ${fresh.filter((p) => !p.phone).length} · ไม่มีวันขาย: ${fresh.filter((p) => !p.sale).length}`);

if (DRY) {
  console.log("\nตัวอย่าง 8 ราย:");
  fresh.slice(0, 8).forEach((p) => console.log(`  ${p.brand} | ${p.name.slice(0, 26)} | ${p.phone || "-"} | ขาย ${p.sale} | หมด ${p.expiry} | ${yearOf(p) >= 2025 ? "CHAN" : "SHARED"}`));
  console.log("\nตัวอย่างซ้ำ (ข้าม):", dup.slice(0, 5).map((p) => p.name.slice(0, 24)).join(" · "));
  process.exit(0);
}

// ===== EXECUTE =====
const dbCats = await rest("GET", "policy_categories?select=id,name");
const motorId = dbCats.find((c) => c.name === "Motor").id;

// insert customers in batches, keep created ids aligned to fresh[]
const custRows = fresh.map((p) => ({ name: p.name, phone: p.phone, customer_type: custType(p.name), owner_id: CH, is_prospect: true, is_shared: true }));
const custIds = [];
for (let i = 0; i < custRows.length; i += 500) {
  const ins = await rest("POST", "customers", custRows.slice(i, i + 500), "return=representation");
  custIds.push(...ins.map((c) => c.id));
  console.log(`customers inserted: ${custIds.length}/${custRows.length}`);
}

// one prospect policy per customer (drives the renewal reminder by expiry)
const polRows = fresh.map((p, idx) => ({
  customer_id: custIds[idx], category_id: motorId, deal_status: "win", is_prospect: true,
  insurance_company: p.insurer, policy_detail: p.detail,
  coverage_start_date: p.sale, coverage_end_date: p.expiry,
  closed_date: p.sale, reported_date: p.sale || new Date().toISOString().slice(0, 10),
  net_premium: null, notes: `Prospect ${p.brand} · ประกันฟรี ${p.freeY} ปี (แม่แถม) · ยังไม่ได้ซื้อต่อกับเรา`,
}));
for (let i = 0; i < polRows.length; i += 300) { await rest("POST", "policies", polRows.slice(i, i + 300)); console.log(`policies inserted: ${Math.min(i + 300, polRows.length)}/${polRows.length}`); }
console.log("DONE");
