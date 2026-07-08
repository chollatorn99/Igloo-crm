"use client";

import { useRef, useState, type ReactNode } from "react";

// Wraps a <form> whose action is a Server Action returning { error?: string }
// (never throwing — Next.js redacts thrown Server Action error messages in
// production builds, so validation errors must come back as data instead).
export function ActionForm({
  action,
  children,
  className,
  confirmMessage,
  resetOnSuccess,
  successMessage,
}: {
  action: (formData: FormData) => Promise<{ error?: string; message?: string } | void>;
  children: ReactNode;
  className?: string;
  confirmMessage?: string;
  resetOnSuccess?: boolean;
  successMessage?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setError(null);
    setNotice(null);
    try {
      const result = await action(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        // A message returned by the action wins over the static
        // successMessage — it can describe which outcome happened.
        setNotice(result?.message ?? successMessage ?? null);
        if (resetOnSuccess) formRef.current?.reset();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className={className}>
      {children}
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
      {notice && !error && <p className="w-full text-xs text-emerald-600">{notice}</p>}
    </form>
  );
}

export function ActionButton({ label, className }: { label: string; className?: string }) {
  return (
    <button type="submit" className={className}>
      {label}
    </button>
  );
}
