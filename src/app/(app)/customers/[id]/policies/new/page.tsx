import { createClient } from "@/lib/supabase/server";
import { NewPolicyForm } from "./form";

export default async function NewPolicyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: me }, { data: categories }, { data: agents }, { data: customer }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
    supabase.from("policy_categories").select("id, name").eq("active", true).order("name"),
    supabase.from("agents").select("id, name").eq("status", "active").order("name"),
    supabase.from("customers").select("name").eq("id", id).single(),
  ]);

  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">เพิ่มกรมธรรม์</h1>
      <p className="mb-6 text-sm text-slate-500">ลูกค้า: {customer?.name}</p>
      <NewPolicyForm
        customerId={id}
        categories={categories ?? []}
        agents={agents ?? []}
        isManager={me?.role === "manager"}
      />
    </div>
  );
}
