import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const wb = XLSX.read(readFileSync(process.argv[2]), { cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets["ประวัติกรมธรรม์ทั้งหมด"], { defval: null });

let sum = 0;
let nonNull = 0;
for (const r of rows) {
  if (r["เบี้ยประกัน"] != null) {
    sum += Number(r["เบี้ยประกัน"]);
    nonNull++;
  }
}
console.log(`source: rows with premium (incl. zero/negative): ${nonNull}, sum: ${sum.toFixed(2)}`);
