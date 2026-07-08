"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/PasswordInput";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Finds the first character outside ISO-8859-1 (Latin-1, code points
  // 0-255) — that's exactly what the browser's fetch() rejects with
  // "String contains non ISO-8859-1 code point" when it ends up in a
  // header. Password fields are masked, so a stray character from
  // copy-paste (smart quotes, a non-breaking space, an invisible
  // zero-width character) would otherwise be undiagnosable.
  function findBadChar(label: string, value: string) {
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code > 255) {
        return `${label} มีตัวอักษรที่ระบบไม่รองรับที่ตำแหน่งที่ ${i + 1} (โค้ด U+${code.toString(16).toUpperCase().padStart(4, "0")}) — ลองลบแล้วพิมพ์ใหม่ทั้งหมดโดยไม่ copy-paste`;
      }
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const badField = findBadChar("อีเมล", email) ?? findBadChar("รหัสผ่าน", password);
    if (badField) {
      setError(badField);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    let signInError: { message: string; cause?: unknown } | null = null;
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      signInError = result.error;
    } catch (err) {
      signInError = {
        message: err instanceof Error ? err.message : String(err),
        cause: err instanceof Error ? err.cause : undefined,
      };
    }

    setLoading(false);

    if (signInError) {
      // Surface the real error instead of always blaming the password —
      // "Invalid login credentials" really does mean wrong email/password,
      // but other causes (rate limit, network, config) need their own
      // message to be diagnosable.
      const causeText = signInError.cause ? ` (cause: ${String(signInError.cause)})` : "";
      setError(
        signInError.message === "Invalid login credentials"
          ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
          : `เข้าสู่ระบบไม่สำเร็จ: ${signInError.message}${causeText}`,
      );
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="mb-1 text-lg font-semibold text-slate-900">Igloo Broker CRM</h1>
        <p className="mb-6 text-sm text-slate-500">เข้าสู่ระบบด้วยอีเมลบริษัท</p>

        <label className="mb-1 block text-xs font-medium text-slate-600">อีเมล</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />

        <label className="mb-1 block text-xs font-medium text-slate-600">รหัสผ่าน</label>
        <div className="mb-4">
          <PasswordInput value={password} onChange={setPassword} required />
        </div>

        {error && <p className="mb-4 text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}
