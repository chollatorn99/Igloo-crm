import { createClient } from "@/lib/supabase/server";
import { AutoPrint } from "../[id]/envelope/auto-print";

const SENDER = (
  <div className="max-w-[130mm] text-sm leading-relaxed text-slate-700">
    <p className="text-xs text-slate-400">ผู้ส่ง (From)</p>
    <p className="font-semibold text-slate-900">บริษัท อิกลู โบรคเกอร์ จำกัด</p>
    <p>เลขที่ 51 อาคารเจแอลทาวเวอร์ ห้องเลขที่ 6 ชั้น 9 ถนนพระราม 9</p>
    <p>แขวงหัวหมาก เขตบางกะปิ กรุงเทพฯ 10240</p>
    <p>โทร. 065-889-7697 / 02-652-9088</p>
  </div>
);

type Row = { id: string; name: string; phone: string | null; address: string | null; shipping_address: string | null };

// Batch A4-landscape envelopes — one page per selected customer, auto-printed.
export default async function EnvelopesBatchPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const idList = (ids ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
  const supabase = await createClient();
  let rows: Row[] = [];
  if (idList.length) {
    const { data } = await supabase
      .from("customers")
      .select("id, name, phone, address, shipping_address")
      .in("id", idList);
    // Preserve the selection order.
    const byId = new Map((data ?? []).map((c) => [c.id, c as Row]));
    rows = idList.map((id) => byId.get(id)).filter(Boolean) as Row[];
  }

  return (
    <div className="p-8">
      <style>{`
        @page { size: A4 landscape; margin: 12mm; }
        @media print {
          body * { visibility: hidden !important; }
          #envelopes, #envelopes * { visibility: visible !important; }
          #envelopes { position: absolute; left: 0; top: 0; width: 100%; }
          .env-page { break-after: page; page-break-after: always; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center gap-3">
        <AutoPrint />
        <span className="text-sm text-slate-500">{rows.length} ซอง</span>
      </div>

      <div id="envelopes">
        {rows.map((c) => {
          const addr = (c.shipping_address ?? c.address ?? "").trim() || "(ยังไม่มีที่อยู่จัดส่ง)";
          return (
            <div key={c.id} className="env-page relative mx-auto mb-8 flex min-h-[180mm] w-full max-w-[273mm] flex-col rounded border border-slate-200 bg-white p-12 print:mb-0 print:border-0">
              <div className="absolute right-12 top-10 h-24 w-20 rounded border-2 border-dashed border-slate-300 p-1 text-center text-[9px] leading-tight text-slate-300">
                ดวงตรา<br />ไปรษณียากร
              </div>
              {SENDER}
              <div className="mt-auto ml-auto w-full max-w-[165mm] pb-6 pr-6">
                <p className="mb-2 text-base text-slate-400">กรุณาส่ง (To)</p>
                <p className="text-3xl font-semibold text-slate-900">{c.name}</p>
                <p className="mt-3 whitespace-pre-line text-xl leading-relaxed text-slate-800">{addr}</p>
                {c.phone && <p className="mt-3 text-lg text-slate-600">โทร. {c.phone}</p>}
                <p className="mt-4 inline-block rounded bg-slate-100 px-2 py-0.5 text-sm text-slate-500">📄 เอกสารกรมธรรม์ + พ.ร.บ.</p>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="no-print text-sm text-slate-400">ไม่มีลูกค้าที่เลือก</p>}
      </div>
    </div>
  );
}
