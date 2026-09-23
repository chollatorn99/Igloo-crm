import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AutoPrint } from "./auto-print";

// A4 LANDSCAPE envelope face (จ่าหน้าซอง) for posting policy documents. Always
// prints Igloo Broker's sender address. Opens in its own tab and auto-prints;
// print CSS hides the app chrome so only #envelope reaches the printer.
export default async function EnvelopePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("customers")
    .select("name, phone, address, shipping_address")
    .eq("id", id)
    .single();
  if (!c) notFound();

  const addr = (c.shipping_address ?? c.address ?? "").trim() || "(ยังไม่มีที่อยู่จัดส่ง)";

  return (
    <div className="p-8">
      <style>{`
        @page { size: A4 landscape; margin: 12mm; }
        @media print {
          body * { visibility: hidden !important; }
          #envelope, #envelope * { visibility: visible !important; }
          #envelope { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <AutoPrint />

      <div id="envelope" className="relative mx-auto flex min-h-[180mm] w-full max-w-[273mm] flex-col rounded border border-slate-200 bg-white p-12 print:border-0">
        {/* Stamp box */}
        <div className="absolute right-12 top-10 h-24 w-20 rounded border-2 border-dashed border-slate-300 p-1 text-center text-[9px] leading-tight text-slate-300">
          ดวงตรา<br />ไปรษณียากร
        </div>

        {/* Sender (always Igloo Broker) */}
        <div className="max-w-[130mm] text-sm leading-relaxed text-slate-700">
          <p className="text-xs text-slate-400">ผู้ส่ง (From)</p>
          <p className="font-semibold text-slate-900">บริษัท อิกลู โบรคเกอร์ จำกัด</p>
          <p>เลขที่ 51 อาคารเจแอลทาวเวอร์ ห้องเลขที่ 6 ชั้น 9 ถนนพระราม 9</p>
          <p>แขวงหัวหมาก เขตบางกะปิ กรุงเทพฯ 10240</p>
          <p>โทร. 065-889-7697 / 02-652-9088</p>
        </div>

        {/* Recipient (lower-right, large) */}
        <div className="mt-auto ml-auto w-full max-w-[165mm] pb-6 pr-6">
          <p className="mb-2 text-base text-slate-400">กรุณาส่ง (To)</p>
          <p className="text-3xl font-semibold text-slate-900">{c.name}</p>
          <p className="mt-3 whitespace-pre-line text-xl leading-relaxed text-slate-800">{addr}</p>
          {c.phone && <p className="mt-3 text-lg text-slate-600">โทร. {c.phone}</p>}
          <p className="mt-4 inline-block rounded bg-slate-100 px-2 py-0.5 text-sm text-slate-500">📄 เอกสารกรมธรรม์ + พ.ร.บ.</p>
        </div>
      </div>

      <p className="no-print mt-4 text-center text-xs text-slate-400">
        แนวนอน A4 · กด Ctrl+P หากหน้าต่างพิมพ์ไม่ขึ้นเอง
      </p>
    </div>
  );
}
