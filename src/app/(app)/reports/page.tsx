import { SalesReportExport } from "./sales-report-export";

export default async function ReportsPage() {
  const today = new Date(Date.now() + 7 * 3600e3); // Thai date
  const to = today.toISOString().slice(0, 10);
  const from = `${to.slice(0, 7)}-01`; // 1st of current month

  return (
    <div className="p-8">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">รายงานยอดขาย (Export)</h1>
      <p className="mb-4 text-xs text-slate-500">
        เลือกช่วงวันแจ้งงาน แล้วดาวน์โหลดเป็น Excel — เห็นเฉพาะงานของตัวเอง
      </p>
      <p className="mb-4 text-xs text-slate-400">
        คอลัมน์: ชื่อลูกค้า · ประเภทประกัน · บริษัทประกัน · ทะเบียน/รุ่นรถ (เฉพาะประกันรถ) · วันแจ้งงาน · วันหมดอายุ ·
        เบี้ยสุทธิ · อากรแสตมป์ · ภาษี (VAT) · เบี้ยรวม · วันชำระเงิน — <span className="font-medium">ไม่มีเบอร์โทร</span>
      </p>
      <SalesReportExport defaultFrom={from} defaultTo={to} />
    </div>
  );
}
