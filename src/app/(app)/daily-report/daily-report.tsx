"use client";

import { useMemo, useState } from "react";
import { saveTarget, saveDailyEntry } from "./actions";

type Brand = { brand: string; units: number; premium: number };
export type ReportData = {
  ownerId: string;
  ownerName: string;
  today: string;
  monthLabel: string;
  lastYearMonthLabel: string;
  lastYearPremium: number;
  dailyPremium: number;
  mtdPremium: number;
  newWin: number;
  renewalWin: number;
  renewalWinByCat: Record<string, number>;
  lostMtd: number;
  lostPremiumMtd: number;
  brandsToday: Brand[];
  brandsMtd: Brand[];
  brandsLastYear: Brand[];
  callsLogged: number;
  target: { target_premium: number | null; existing_target: number | null } | null;
  entry: { new_quotes: number | null; tbd: number | null; new_calls: number | null; follow_ups: number | null; no_response: number | null; wrong_number: number | null; note: string | null } | null;
  month: string;
};

const baht = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MOTOR_BRANDS = ["BRG", "DEEPAL", "POCCO", "KIA", "CHERY", "อื่นๆ"];

export function DailyReport({ data, template }: { data: ReportData; template: "motor" | "general" }) {
  const e = data.entry;
  const [targetPremium, setTargetPremium] = useState(data.target?.target_premium?.toString() ?? "");
  const [existingTarget, setExistingTarget] = useState(data.target?.existing_target?.toString() ?? "");
  const [newQuotes, setNewQuotes] = useState(e?.new_quotes?.toString() ?? "");
  const [tbd, setTbd] = useState(e?.tbd?.toString() ?? "");
  const [newCalls, setNewCalls] = useState(e?.new_calls?.toString() ?? "");
  const [followUps, setFollowUps] = useState(e?.follow_ups?.toString() ?? (data.callsLogged ? String(data.callsLogged) : ""));
  const [noResponse, setNoResponse] = useState(e?.no_response?.toString() ?? "");
  const [wrongNumber, setWrongNumber] = useState(e?.wrong_number?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const n = (v: string) => (v.trim() === "" ? 0 : Number(v));

  const renewalCatStr = Object.entries(data.renewalWinByCat).map(([k, v]) => `${k} ${v} case`).join(", ") || "-";

  const text = useMemo(() => {
    if (template === "general") {
      return [
        "✔️Igloo Broker Daily Report",
        `Date : ${data.today}`,
        "",
        `${data.lastYearMonthLabel} Premium : ${baht(data.lastYearPremium)}  Baht`,
        "",
        `Monthly Target: ${targetPremium ? baht(n(targetPremium)) : ""}`,
        "Target Premium:",
        `Existing Target Premium: ${existingTarget ? baht(n(existingTarget)) : ""}`,
        "",
        "Daily Results",
        `New Quotes : ${n(newQuotes)} cases`,
        `TBD : ${n(tbd)} cases`,
        "",
        `✅️New Win : ${data.newWin} case`,
        `✅️Renewal Win : ${data.renewalWin} case ( ${renewalCatStr} )`,
        `Total daily premium : ${baht(data.dailyPremium)}  Baht`,
        `✅️MTD Premium : ${baht(data.mtdPremium)}  Baht`,
        `❌️ Monthly lost cases: ${data.lostMtd || "-"}`,
        `❌️Total Premium Lost cases: ${data.lostPremiumMtd ? baht(data.lostPremiumMtd) : "-"}`,
        `Monthly target : ${targetPremium ? baht(n(targetPremium)) : "-"}  Baht`,
      ].join("\n");
    }
    // motor template
    const byBrand = (list: Brand[], b: string) => list.find((x) => x.brand === b);
    const lastYearLines = MOTOR_BRANDS.map((b) => {
      const g = byBrand(data.brandsLastYear, b);
      return g ? `${b} : ${data.lastYearMonthLabel}\nPremium : ${baht(g.premium)} Baht` : null;
    }).filter(Boolean);
    const todayLines = MOTOR_BRANDS.map((b) => {
      const g = byBrand(data.brandsToday, b);
      return `${b}\nTotal no. of units: ${g?.units ?? 0}\nPremium: ${baht(g?.premium ?? 0)} Baht`;
    });
    const mtdLines = MOTOR_BRANDS.map((b) => `✅️MTD Premium ${b} : ${baht(byBrand(data.brandsMtd, b)?.premium ?? 0)} Baht`);
    return [
      "BRG Motors: Igloo Broker Daily Report",
      `Report Date : ${data.today}`,
      ...lastYearLines,
      "",
      ...todayLines,
      "",
      `Daily Results`,
      `New Quotes : ${n(newQuotes)}`,
      `Daily New Calls: ${n(newCalls)}`,
      `Daily Follow up: ${n(followUps)}`,
      `No response: ${n(noResponse)}`,
      `Wrong number: ${n(wrongNumber)}`,
      "",
      `✅️New Win : ${data.newWin}`,
      `✅️Renewal Win : ${data.renewalWin} Case ( ${renewalCatStr} )`,
      `❌️ Lost case: ${data.lostMtd || "-"}`,
      "",
      `Total daily premium ${baht(data.dailyPremium)} Baht`,
      ...mtdLines,
      `✅️MTD Total Premium : ${baht(data.mtdPremium)} Baht`,
      `Monthly target : ${targetPremium ? baht(n(targetPremium)) : "-"} Baht`,
    ].join("\n");
  }, [template, data, targetPremium, existingTarget, newQuotes, tbd, newCalls, followUps, noResponse, wrongNumber, renewalCatStr]);

  async function save() {
    setSaving(true); setSavedMsg("");
    const tf = new FormData();
    tf.set("target_premium", targetPremium); tf.set("existing_target", existingTarget);
    await saveTarget(data.ownerId, data.month, tf);
    const df = new FormData();
    df.set("new_quotes", newQuotes); df.set("tbd", tbd); df.set("new_calls", newCalls);
    df.set("follow_ups", followUps); df.set("no_response", noResponse); df.set("wrong_number", wrongNumber);
    const res = await saveDailyEntry(data.ownerId, new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), df);
    setSaving(false);
    setSavedMsg(res.error ? `ผิดพลาด: ${res.error}` : "บันทึกแล้ว ✓");
  }

  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  const field = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
  const lbl = "mb-1 block text-xs text-slate-500";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-700">กรอกเพิ่ม (ระบบไม่ได้เก็บ) — เซฟไว้ให้</p>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div><label className={lbl}>Monthly Target (เบี้ย)</label><input value={targetPremium} onChange={(e) => setTargetPremium(e.target.value)} type="number" className={field} /></div>
          <div><label className={lbl}>Existing Target</label><input value={existingTarget} onChange={(e) => setExistingTarget(e.target.value)} type="number" className={field} /></div>
          <div><label className={lbl}>New Quotes</label><input value={newQuotes} onChange={(e) => setNewQuotes(e.target.value)} type="number" className={field} /></div>
          <div><label className={lbl}>TBD</label><input value={tbd} onChange={(e) => setTbd(e.target.value)} type="number" className={field} /></div>
          {template === "motor" && <>
            <div><label className={lbl}>Daily New Calls</label><input value={newCalls} onChange={(e) => setNewCalls(e.target.value)} type="number" className={field} /></div>
            <div><label className={lbl}>Daily Follow up <span className="text-sky-600">(ระบบมี {data.callsLogged})</span></label><input value={followUps} onChange={(e) => setFollowUps(e.target.value)} type="number" className={field} /></div>
            <div><label className={lbl}>No response</label><input value={noResponse} onChange={(e) => setNoResponse(e.target.value)} type="number" className={field} /></div>
            <div><label className={lbl}>Wrong number</label><input value={wrongNumber} onChange={(e) => setWrongNumber(e.target.value)} type="number" className={field} /></div>
          </>}
        </div>
        <button onClick={save} disabled={saving} className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
          {saving ? "กำลังบันทึก..." : "บันทึกตัวเลขที่กรอก"}
        </button>
        {savedMsg && <span className="ml-2 text-xs text-emerald-600">{savedMsg}</span>}
        <p className="mt-3 text-[11px] text-slate-400">ตัวเลขเงิน/วิน/แบรนด์/MTD ดึงจากระบบอัตโนมัติตามวันแจ้งงานของ {data.ownerName} — แก้ช่องบนแล้วข้อความขวาจะอัปเดตทันที</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">ข้อความพร้อมส่ง</p>
          <button onClick={copy} className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
            {copied ? "คัดลอกแล้ว ✓" : "Copy"}
          </button>
        </div>
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">{text}</pre>
      </div>
    </div>
  );
}
