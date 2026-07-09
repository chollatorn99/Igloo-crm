import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetchAll";
import { ExportButton } from "@/app/(app)/payments/export-button";

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  customer_type: string;
  call_count: number;
  last_call_result: string | null;
  owner: { full_name: string } | null;
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let customers: CustomerRow[] = [];
  let error: string | null = null;
  try {
    customers = await fetchAll<CustomerRow>((from, to) => {
      let query = supabase
        .from("customers")
        .select("id, name, phone, customer_type, call_count, last_call_result, owner:profiles(full_name)")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (q?.trim()) {
        const term = q.trim().replace(/[%,()]/g, "");
        query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
      }
      return query as unknown as PromiseLike<{ data: CustomerRow[] | null; error: { message: string } | null }>;
    });
  } catch (err) {
    error = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
  }

  const exportRows = customers.map((c) => ({
    ชื่อ: c.name,
    เบอร์โทร: c.phone,
    ประเภท: c.customer_type === "organization" ? "องค์กร" : "บุคคล",
    เจ้าของ: c.owner?.full_name,
    จำนวนครั้งที่โทร: c.call_count,
    ผลล่าสุด: c.last_call_result,
  }));

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">ลูกค้า</h1>
          <p className="text-xs text-slate-500">
            {customers.length} รายการ{q ? ` (ค้นหา: "${q}")` : ""} — เห็นตามสิทธิ์ของบัญชีคุณ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form className="flex gap-2">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="ค้นหาชื่อ / เบอร์โทร"
              className="w-48 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              ค้นหา
            </button>
          </form>
          <ExportButton rows={exportRows} filename="customers" />
          <Link
            href="/customers/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + เพิ่มลูกค้า
          </Link>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
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
            {customers.map((c) => (
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
                <td className="px-4 py-3 text-slate-600">{c.owner?.full_name ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{c.call_count}</td>
                <td className="px-4 py-3 text-slate-600">{c.last_call_result ?? "-"}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  {q ? "ไม่พบลูกค้าที่ค้นหา" : 'ยังไม่มีลูกค้า — กด "+ เพิ่มลูกค้า" เพื่อเริ่ม'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
