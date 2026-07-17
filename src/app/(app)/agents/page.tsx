import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { createAgent, setAgentStatus } from "./actions";

type Agent = { id: string; name: string; phone: string | null; status: string };

export default async function AgentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  const isManager = me?.role === "manager";

  const { data } = await supabase.from("agents").select("id, name, phone, status").order("name");
  const agents = (data ?? []) as Agent[];

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Agent (นายหน้าอิสระ)</h1>
      <p className="mb-6 text-xs text-slate-500">
        รายชื่อ Agent ที่ได้รับค่าคอมมิชชั่น — เพิ่มที่นี่แล้วจะเลือกได้ในหน้ากรมธรรม์
      </p>

      <ActionForm action={createAgent} resetOnSuccess className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">ชื่อ Agent</label>
          <input name="name" required className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">เบอร์โทร (ถ้ามี)</label>
          <input name="phone" className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <SubmitButton
          pendingLabel="กำลังเพิ่ม…"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + เพิ่ม Agent
        </SubmitButton>
      </ActionForm>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ชื่อ Agent</th>
              <th className="px-4 py-3">เบอร์โทร</th>
              <th className="px-4 py-3">สถานะ</th>
              {isManager && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {agents.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{a.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{a.phone ?? "-"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {a.status === "active" ? "ใช้งาน" : "ปิด"}
                  </span>
                </td>
                {isManager && (
                  <td className="px-4 py-3 text-right">
                    <ActionForm action={setAgentStatus.bind(null, a.id, a.status === "active" ? "inactive" : "active")}>
                      <SubmitButton className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                        {a.status === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                      </SubmitButton>
                    </ActionForm>
                  </td>
                )}
              </tr>
            ))}
            {agents.length === 0 && (
              <tr>
                <td colSpan={isManager ? 4 : 3} className="px-4 py-10 text-center text-slate-400">
                  ยังไม่มี Agent — เพิ่มด้านบน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
