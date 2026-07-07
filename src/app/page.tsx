import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/logout/actions";

type NavItem = { label: string; href: string | null };

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  manager: [
    { label: "ลูกค้าทั้งหมด", href: "/customers" },
    { label: "คิวตรวจสอบการชำระเงิน", href: null },
    { label: "ประวัติลูกค้าเก่า", href: null },
    { label: "Performance", href: null },
    { label: "Settings", href: null },
  ],
  sales: [
    { label: "ลูกค้าของฉัน", href: "/customers" },
    { label: "ประวัติลูกค้าเก่า", href: null },
    { label: "Performance", href: null },
  ],
  accounting: [{ label: "คิวตรวจสอบการชำระเงิน", href: null }],
};

export default async function DashboardHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, must_change_password")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Authenticated in Supabase Auth but no matching profiles row yet —
    // a manager needs to provision this account before it can be used.
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-600">
          บัญชีนี้ยังไม่ถูกตั้งค่าในระบบ — กรุณาติดต่อ Manager
        </p>
      </div>
    );
  }

  if (profile.must_change_password) {
    redirect("/change-password");
  }

  const navItems = NAV_BY_ROLE[profile.role] ?? [];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-5">
        <p className="mb-6 text-sm font-semibold text-slate-900">Igloo Broker CRM</p>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {item.label}
              </Link>
            ) : (
              <span key={item.label} className="rounded-md px-3 py-2 text-sm text-slate-400">
                {item.label}
                <span className="ml-1 text-[10px] text-slate-400">(เร็วๆนี้)</span>
              </span>
            ),
          )}
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-slate-900">
              สวัสดี, {profile.full_name}
            </p>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {profile.role}
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              ออกจากระบบ
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
          Login และแบ่ง role ทำงานแล้ว — ฟีเจอร์จัดการลูกค้า/กรมธรรม์กำลังจะตามมาในขั้นตอนถัดไป
        </div>
      </main>
    </div>
  );
}
