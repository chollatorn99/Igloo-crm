import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetchAll";
import { Pagination } from "@/components/Pagination";

// One row per CUSTOMER that has follow-up notes — so a salesperson who can't
// recall a name can still find everyone they've been calling, newest contact
// first. (The /activity page is the chronological event view; this is the
// grouped-by-customer view.)
type NoteRow = {
  customer_id: string;
  note_text: string;
  created_at: string;
  author_id: string;
  customer: { name: string; phone: string | null } | null;
};

const PAGE_SIZE = 50;

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; actor?: string; mine?: string; page?: string }>;
}) {
  const { q, actor, mine, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  const isManager = me?.role === "manager";
  const people = isManager
    ? (await supabase.from("profiles").select("id, full_name").in("role", ["sales", "manager", "support"]).order("full_name")).data
    : null;

  const notes = await fetchAll<NoteRow>((from, to) => {
    let query = supabase
      .from("follow_up_notes")
      .select("customer_id, note_text, created_at, author_id, customer:customers!inner(name, phone)")
      .not("note_text", "ilike", "[ยุบจากรายชื่อซ้ำ]%") // dedup housekeeping notes aren't calls
      .order("created_at", { ascending: false })
      .range(from, to);
    if (isManager && actor) query = query.eq("author_id", actor);
    if (mine === "1") query = query.eq("author_id", user!.id);
    if (q?.trim()) query = query.ilike("customer.name", `%${q.trim().replace(/[%,()]/g, "")}%`);
    return query as unknown as PromiseLike<{ data: NoteRow[] | null; error: { message: string } | null }>;
  });

  // Group by customer — notes arrive newest-first, so the first per customer is
  // the latest contact.
  const byCustomer = new Map<string, { name: string; phone: string | null; count: number; last: string; lastNote: string }>();
  for (const n of notes) {
    if (!n.customer) continue;
    const g = byCustomer.get(n.customer_id);
    if (g) g.count++;
    else byCustomer.set(n.customer_id, { name: n.customer.name, phone: n.customer.phone, count: 1, last: n.created_at, lastNote: n.note_text });
  }
  const all = [...byCustomer.entries()].sort((a, b) => (a[1].last < b[1].last ? 1 : -1));
  const total = all.length;
  const rows = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="p-8">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">ลูกค้าที่ติดตาม (Follow-up)</h1>
      <p className="mb-4 text-xs text-slate-500">
        {total.toLocaleString()} ลูกค้า · รวมเป็นรายคน เรียงตามการติดตามล่าสุด — หาลูกค้าที่เคยโทรได้โดยไม่ต้องจำชื่อ
      </p>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="ค้นหาชื่อลูกค้า"
          className="w-48 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        />
        {isManager ? (
          <select name="actor" defaultValue={actor ?? ""} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">ทุกคน</option>
            {people?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        ) : (
          <label className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600">
            <input type="checkbox" name="mine" value="1" defaultChecked={mine === "1"} className="h-4 w-4" />
            เฉพาะที่ฉันบันทึก
          </label>
        )}
        <button className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800">กรอง</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ลูกค้า</th>
              <th className="px-4 py-3">เบอร์โทร</th>
              <th className="px-4 py-3">จำนวนครั้ง</th>
              <th className="px-4 py-3">ติดตามล่าสุด</th>
              <th className="px-4 py-3">โน้ตล่าสุด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(([id, c]) => (
              <tr key={id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/customers/${id}`} className="font-medium text-slate-900 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.phone ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{c.count}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmt(c.last)}</td>
                <td className="px-4 py-3 text-slate-600">{c.lastNote}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  ยังไม่มีการบันทึกติดตาม
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} params={{ q, actor, mine }} />
    </div>
  );
}
