"use client";

import { useRef, useState, type ReactNode } from "react";

export function ActionForm({
  action,
  children,
  className,
  confirmMessage,
  resetOnSuccess,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
  confirmMessage?: string;
  resetOnSuccess?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setError(null);
    try {
      await action(formData);
      if (resetOnSuccess) formRef.current?.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className={className}>
      {children}
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
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
