import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const file = process.argv[2];
const wb = XLSX.read(readFileSync(file), { cellDates: true });

console.log("SHEETS:", JSON.stringify(wb.SheetNames));

for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
  console.log(`\n=== ${name} (${rows.length} rows) ===`);
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    console.log(`ROW${i}:`, JSON.stringify(rows[i]).slice(0, 800));
  }
}
