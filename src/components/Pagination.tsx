import Link from "next/link";

// Prev/next + page indicator that preserves the current query string
// (search term, filters) while only swapping the `page` param.
export function Pagination({
  page,
  pageSize,
  total,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string | undefined>;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== "page") sp.set(k, v);
    }
    sp.set("page", String(p));
    return `?${sp.toString()}`;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span className="text-xs text-slate-500">
        แสดง {from.toLocaleString()}–{to.toLocaleString()} จาก {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100">
            ← ก่อนหน้า
          </Link>
        ) : (
          <span className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-300">← ก่อนหน้า</span>
        )}
        <span className="text-xs text-slate-500">
          หน้า {page} / {lastPage}
        </span>
        {page < lastPage ? (
          <Link href={href(page + 1)} className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100">
            ถัดไป →
          </Link>
        ) : (
          <span className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-300">ถัดไป →</span>
        )}
      </div>
    </div>
  );
}
