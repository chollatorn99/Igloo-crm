import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExportButton } from "@/app/(app)/payments/export-button";

export default async function CustomersPage() {
  const supabase = await createClient();

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, name, phone, customer_type, call_count, last_call_result, owner:profiles(full_name)")
    .order("created_at", { ascending: false });

  const exportRows = (customers ?? []).map((c) => ({
    ชื่อ: c.name,
    เบอร์โทร: c.phone,
    ประเภท: c.customer_type === "organization" ? "องค์กร" : "บุคคล",
    เจ้าของ: (c.owner as unknown as { full_name: string } | null)?.full_name,
    จำนวนครั้งที่โทร: c.call_count,
    ผลล่าสุด: c.last_call_result,
  }));

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">ลูกค้า</h1>
          <p className="text-xs text-slate-500">
            {customers?.length ?? 0} รายการ — เห็นตามสิทธิ์ของบัญชีคุณ
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton rows={exportRows} filename="customers" />
          <Link
            href="/customers/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + เพิ่มลูกค้า
          </Link>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ชื่อ</th>
              <th className="px-4 py-3">เบอร์โทร</th>
              <th className="px-4 py-3">ประเภท</th>
              <th className="px-4 py-3">เจ้าของ</th>
              <th className="px-4 py-3">จำนวนครั้งที่โทร</th>
              <th className="px-4 py-3">ผลล่าสุด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers?.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/customers/${c.id}`} className="font-medium text-slate-900 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.phone ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {c.customer_type === "organization" ? "องค์กร" : "บุคคล"}
                </td>
                <td className="px-4 py-3 text-slate-600">{(c.owner as unknown as { full_name: string } | null)?.full_name ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{c.call_count}</td>
                <td className="px-4 py-3 text-slate-600">{c.last_call_result ?? "-"}</td>
              </tr>
            ))}
            {customers?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  ยังไม่มีลูกค้า — กด &quot;+ เพิ่มลูกค้า&quot; เพื่อเริ่ม
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
