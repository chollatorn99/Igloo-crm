import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewClaimForm } from "./form";

export default async function NewClaimPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { customer } = await searchParams;
  const supabase = await createClient();

  if (!customer) {
    return (
      <div className="p-8">
        <h1 className="mb-2 text-lg font-semibold text-slate-900">แจ้งเคลมใหม่</h1>
        <p className="text-sm text-slate-500">เริ่มจากหน้าลูกค้า — เปิดลูกค้าที่ต้องการ แล้วกดปุ่ม &quot;+ แจ้งเคลม&quot;</p>
        <Link href="/customers" className="mt-3 inline-block text-sm text-blue-600 hover:underline">ไปหน้าลูกค้า →</Link>
      </div>
    );
  }

  const { data: cust } = await supabase.from("customers").select("name").eq("id", customer).single();
  const { data: pols } = await supabase
    .from("policies")
    .select("id, policy_detail, category:policy_categories(name), insurance_company")
    .eq("customer_id", customer)
    .order("created_at", { ascending: false });
  const policies = (pols ?? []).map((p) => ({
    id: p.id,
    label: [(p.category as unknown as { name: string } | null)?.name, p.insurance_company, p.policy_detail].filter(Boolean).join(" · ") || "กรมธรรม์",
  }));

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link href={`/customers/${customer}`} className="mb-4 inline-block text-xs text-slate-500 hover:underline">← กลับหน้าลูกค้า</Link>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">แจ้งเคลมใหม่</h1>
      <NewClaimForm customerId={customer} customerName={cust?.name ?? "-"} policies={policies} />
    </div>
  );
}
