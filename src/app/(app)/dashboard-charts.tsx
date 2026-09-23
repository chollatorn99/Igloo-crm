"use client";

import { useState } from "react";

export type Slice = { label: string; value: number; color: string };

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

// ---- Interactive donut (hover a slice → center shows its label/value/%) ----
function Donut({ title, data, unit = "฿" }: { title: string; data: Slice[]; unit?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 180, r = 80, rIn = 52, cx = size / 2, cy = size / 2;
  let angle = -Math.PI / 2;
  const seg = data.map((d) => {
    const frac = total > 0 ? d.value / total : 0;
    const start = angle;
    const end = angle + frac * Math.PI * 2;
    angle = end;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const xi2 = cx + rIn * Math.cos(end), yi2 = cy + rIn * Math.sin(end);
    const xi1 = cx + rIn * Math.cos(start), yi1 = cy + rIn * Math.sin(start);
    const path = `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${xi2},${yi2} A${rIn},${rIn} 0 ${large} 0 ${xi1},${yi1} Z`;
    return { ...d, path, frac };
  });
  const center = active !== null ? seg[active] : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-2 text-sm font-semibold text-slate-600">{title}</p>
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">ไม่มีข้อมูล</p>
      ) : (
        <div className="flex items-center gap-4">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
            {seg.map((s, i) => (
              <path
                key={i}
                d={s.path}
                fill={s.color}
                opacity={active === null || active === i ? 1 : 0.35}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                style={{ transition: "opacity .15s", cursor: "default" }}
              />
            ))}
            <text x={cx} y={cy - 6} textAnchor="middle" className="fill-slate-900" style={{ fontSize: 13, fontWeight: 600 }}>
              {center ? `${Math.round(center.frac * 100)}%` : baht(total)}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>
              {center ? (center.label.length > 12 ? center.label.slice(0, 12) + "…" : center.label) : `รวม ${unit}`}
            </text>
          </svg>
          <div className="min-w-0 flex-1 space-y-1">
            {seg.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded px-1.5 py-1 text-xs"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                style={{ background: active === i ? "#f1f5f9" : undefined }}
              >
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate text-slate-600" title={s.label}>{s.label}</span>
                <span className="shrink-0 font-mono text-slate-700">{baht(s.value)}</span>
                <span className="w-9 shrink-0 text-right text-slate-400">{Math.round(s.frac * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Interactive horizontal bar list ----
function BarList({ title, data, note, count }: { title: string; data: Slice[]; note?: string; count?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = (v: number) => (count ? `${v.toLocaleString("th-TH")} ราย` : baht(v));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-2 text-sm font-semibold text-slate-600">{title}</p>
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">ไม่มีข้อมูล</p>
      ) : (
        <div className="space-y-1.5">
          {data.map((d, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="w-28 shrink-0 truncate text-slate-600" title={d.label}>{d.label}</span>
              <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                <div
                  className="h-full rounded"
                  style={{ width: `${(d.value / max) * 100}%`, background: d.color, opacity: active === null || active === i ? 1 : 0.4, transition: "opacity .15s" }}
                />
              </div>
              <span className="w-24 shrink-0 text-right font-mono text-slate-700">{fmt(d.value)}</span>
            </div>
          ))}
        </div>
      )}
      {note && <p className="mt-2 text-xs text-slate-400">{note}</p>}
    </div>
  );
}

export function DashboardCharts({
  salesShare,
  insurers,
  payment,
  brands,
}: {
  salesShare: Slice[];
  insurers: Slice[];
  payment: Slice[];
  brands: Slice[];
}) {
  return (
    <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {salesShare.length > 0 && <Donut title="สัดส่วนยอดขายรายพนักงาน (เบี้ยสุทธิ)" data={salesShare} />}
      <Donut title="สถานะการเก็บเงิน (เบี้ยรวม)" data={payment} />
      <BarList title="บริษัทประกันขายมากสุด (เบี้ยสุทธิ)" data={insurers} note="Top 8 ตามเบี้ยประกันในช่วงที่เลือก" />
      <BarList title="จำนวนรายที่ขายแยกตามแบรนด์รถ" data={brands} count note="อ่านจากรายละเอียดกรมธรรม์ (policy_detail)" />
    </div>
  );
}
