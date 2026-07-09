import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const wb = XLSX.read(readFileSync(process.argv[2]), { cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets["ประวัติกรมธรรม์ทั้งหมด"], { defval: null });
const samples = rows
  .filter((r) => r["ค่าคอม"] != null)
  .slice(0, 20)
  .map((r) => ({ premium: r["เบี้ยประกัน"], com: r["ค่าคอม"], discount: r["ส่วนลด"] }));
console.log(JSON.stringify(samples, null, 1));
