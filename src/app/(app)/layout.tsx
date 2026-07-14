import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/logout/actions";

type NavItem = { label: string; href: string };

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  manager: [
    { label: "หน้าหลัก (Dashboard)", href: "/" },
    { label: "ลูกค้าทั้งหมด", href: "/customers" },
    { label: "แจ้งเตือนต่ออายุ", href: "/renewals" },
    { label: "คิวตรวจสอบการชำระเงิน", href: "/payments" },
    { label: "ประวัติลูกค้าเก่า", href: "/history" },
    { label: "บันทึกกิจกรรม", href: "/activity" },
    { label: "Settings", href: "/settings" },
  ],
  sales: [
    { label: "หน้าหลัก (Dashboard)", href: "/" },
    { label: "ลูกค้าของฉัน", href: "/customers" },
    { label: "แจ้งเตือนต่ออายุ", href: "/renewals" },
    { label: "ประวัติลูกค้าเก่า", href: "/history" },
    { label: "บันทึกกิจกรรมของฉัน", href: "/activity" },
  ],
  accounting: [
    { label: "หน้าหลัก (Dashboard)", href: "/" },
    { label: "คิวตรวจสอบการชำระเงิน", href: "/payments" },
  ],
};

// Shared shell for every authenticated page — the sidebar (with a หน้าหลัก
// link) follows the user everywhere, so no page is a dead end.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
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
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white p-4 md:min-h-screen md:w-56 md:border-b-0 md:border-r md:p-5">
        <p className="mb-4 text-sm font-semibold text-slate-900 md:mb-6">Igloo Broker CRM</p>
        <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 md:mt-auto md:block md:pt-4">
          <div>
            <p className="text-xs font-medium text-slate-700">{profile.full_name}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">{profile.role}</p>
          </div>
          <form action={signOut} className="md:mt-3">
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              ออกจากระบบ
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
