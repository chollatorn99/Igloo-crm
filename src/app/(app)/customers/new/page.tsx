import { createClient } from "@/lib/supabase/server";
import { NewCustomerForm } from "./form";

export default async function NewCustomerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  let salesOptions: { id: string; full_name: string }[] = [];
  if (profile?.role === "manager") {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["sales", "manager"])
      .eq("status", "active")
      .order("full_name");
    salesOptions = data ?? [];
  }

  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="mb-6 text-lg font-semibold text-slate-900">เพิ่มลูกค้าใหม่</h1>
      <NewCustomerForm salesOptions={salesOptions} isManager={profile?.role === "manager"} />
    </div>
  );
}
