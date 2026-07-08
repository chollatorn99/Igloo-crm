"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/PasswordInput";
import { clearMustChangePassword } from "./actions";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (password !== confirm) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    await clearMustChangePassword();
    setLoading(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="mb-1 text-lg font-semibold text-slate-900">ตั้งรหัสผ่านใหม่</h1>
        <p className="mb-6 text-sm text-slate-500">
          เข้าระบบครั้งแรก กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานต่อ
        </p>

        <label className="mb-1 block text-xs font-medium text-slate-600">รหัสผ่านใหม่</label>
        <div className="mb-4">
          <PasswordInput value={password} onChange={setPassword} required />
        </div>

        <label className="mb-1 block text-xs font-medium text-slate-600">ยืนยันรหัสผ่านใหม่</label>
        <div className="mb-4">
          <PasswordInput value={confirm} onChange={setConfirm} required />
        </div>

        {error && <p className="mb-4 text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
        </button>
      </form>
    </div>
  );
}
