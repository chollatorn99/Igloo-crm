// Import Chery car buyers (BRG dealer, 4 branches) delivered since Oct 2025 as
// พี่มุก's prospects — leads to chase for renewal, NOT our sales.
// is_prospect=true, owner=Chanpimook, is_shared=false (all 2025/26 → พี่มุก only).
// Captures phone/email/address. Dedups by phone+name against existing customers.
// DRY=1 previews without writing.
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const FILE = "D:/Claude folder/Igloo/BRG and Dealer customers/chery for Igloo Oct 25 to Aug 26.xlsx";
const CH = "3275c3e2-2c5e-4787-abba-54c10df39127"; // Chanpimook
const CUTOFF = "2025-10-01"; // ออกรถตั้งแต่ ต.ค. ปีที่แล้ว
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
// Excel serials came in tz-shifted (…T16:59:56Z); +7h then round to nearest day.
const dOnly = (v) => {
  if (v instanceof Date) { const s = new Date(Math.round((v.getTime() + 7 * 3600e3) / 86400e3) * 86400e3); return s.toISOString().slice(0, 10); }
  const m = String(v ?? "").match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/); if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
};
const plusYears = (d, n) => { if (!d) return null; const [y, m, dd] = d.split("-").map(Number); const day = m === 2 && dd === 29 ? 28 : dd; return `${y + n}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`; };

const wb = XLSX.read(readFileSync(FILE), { cellDates: true });
const recs = [];
for (const sn of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: null, header: 1 });
  // Map by header name (column order differs per branch sheet).
  const hdr = (rows[0] || []).map((h) => norm(h));
  const col = (name) => hdr.indexOf(name);
  const iName = col("ชื่อ"), iType = col("ประเภทลูกค้า"), iPhone = col("เบอร์ติดต่อ"),
    iEmail = col("อีเมล"), iAddr = col("ที่อยู่ติดต่อ"), iAmphoe = col("อำเภอและเทศมณฑล"),
    iCity = col("เมือง"), iProv = col("จังหวัด"), iVin = col("VIN"),
    iVariant = col("ชื่อรุ่น"), iCarType = col("ชื่อประเภทของรถ"),
    iDate = col("วันที่ออกรถ") >= 0 ? col("วันที่ออกรถ") : col("วันที่ออกใบแจ้งหนี้");
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const name = norm(r[iName]); if (!name || name.length < 2) continue;
    const sale = dOnly(r[iDate]); if (!sale || sale < CUTOFF) continue; // เฉพาะออกรถตั้งแต่ ต.ค. 2025
    const address = [iAddr, iAmphoe, iCity, iProv].filter((x) => x >= 0).map((x) => norm(r[x])).filter(Boolean).join(" ") || null;
    const cartype = norm(r[iCarType]); // e.g. "CHERY V23"
    const variant = norm(r[iVariant]); // e.g. "V23 2WD PLUS Black Black"
    const vin = norm(r[iVin]);
    const detail = [cartype || "CHERY", variant, vin && `VIN ${vin}`].filter(Boolean).join(" · ");
    recs.push({
      branch: sn, name, phone: normPhone(r[iPhone]),
      email: iEmail >= 0 ? (norm(r[iEmail]) || null) : null, address,
      is_org: norm(r[iType]).includes("องค์กร"),
      sale, expiry: plusYears(sale, 1), detail,
    });
  }
}
console.log(`อ่านจากไฟล์ (ออกรถ >= ${CUTOFF}): ${recs.length} ราย`);

// dedup within file (phone, else name)
const seen = new Set(); const uniq = [];
for (const p of recs) { const k = p.phone ? "p:" + p.phone : "n:" + keyName(p.name); if (seen.has(k)) continue; seen.add(k); uniq.push(p); }
console.log(`หลังตัดซ้ำในไฟล์เอง: ${uniq.length}`);

// dedup against existing customers
const existing = [];
for (let o = 0; ; o += 1000) { const pg = await rest("GET", `customers?select=name,phone&offset=${o}&limit=1000`); existing.push(...pg); if (pg.length < 1000) break; }
const exPhones = new Set(existing.map((c) => normPhone(c.phone)).filter(Boolean));
const exNames = new Set(existing.map((c) => keyName(c.name)));
const fresh = [], dup = [];
for (const p of uniq) ((p.phone && exPhones.has(p.phone)) || exNames.has(keyName(p.name)) ? dup : fresh).push(p);

const byBranch = {}; fresh.forEach((p) => (byBranch[p.branch] = (byBranch[p.branch] || 0) + 1));
console.log(`\nซ้ำกับลูกค้าเดิม (ข้าม): ${dup.length}`);
console.log(`เพิ่มใหม่: ${fresh.length} · แยกสาขา ${JSON.stringify(byBranch)}`);
console.log(`  มีที่อยู่ ${fresh.filter((p) => p.address).length} · มีอีเมล ${fresh.filter((p) => p.email).length} · ไม่มีเบอร์ ${fresh.filter((p) => !p.phone).length}`);
const dr = fresh.map((p) => p.sale).sort();
console.log(`  ช่วงวันออกรถ: ${dr[0]} → ${dr[dr.length - 1]}`);

if (DRY) {
  console.log("\nตัวอย่าง 8 ราย:");
  fresh.slice(0, 8).forEach((p) => console.log(`  ${p.branch} | ${p.name.slice(0, 22)} | ${p.phone || "-"} | ออกรถ ${p.sale} | หมดฟรี ${p.expiry} | ${p.detail.slice(0, 40)}`));
  console.log("\nซ้ำ (ข้าม) ตัวอย่าง:", dup.slice(0, 6).map((p) => p.name.slice(0, 20)).join(" · "));
  process.exit(0);
}

// ===== EXECUTE =====
const dbCats = await rest("GET", "policy_categories?select=id,name");
const motorId = dbCats.find((c) => c.name === "Motor").id;

const custRows = fresh.map((p) => ({
  name: p.name, phone: p.phone, email: p.email, address: p.address,
  customer_type: p.is_org ? "organization" : "individual",
  owner_id: CH, is_prospect: true, is_shared: false,
}));
const custIds = [];
for (let i = 0; i < custRows.length; i += 500) {
  const ins = await rest("POST", "customers", custRows.slice(i, i + 500), "return=representation");
  custIds.push(...ins.map((c) => c.id));
  console.log(`customers inserted: ${custIds.length}/${custRows.length}`);
}

const polRows = fresh.map((p, idx) => ({
  customer_id: custIds[idx], category_id: motorId, deal_status: "win", is_prospect: true,
  policy_detail: p.detail, coverage_start_date: p.sale, coverage_end_date: p.expiry,
  closed_date: p.sale, reported_date: p.sale, net_premium: null,
  notes: `Prospect CHERY (${p.branch}) · ประกันฟรี 1 ปี (แม่แถม) · ยังไม่ได้ซื้อต่อกับเรา`,
}));
for (let i = 0; i < polRows.length; i += 300) { await rest("POST", "policies", polRows.slice(i, i + 300)); console.log(`policies inserted: ${Math.min(i + 300, polRows.length)}/${polRows.length}`); }
console.log("DONE");
