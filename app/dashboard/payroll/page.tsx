"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCurrency } from "@/lib/currency";
import { DEFAULT_COUNTRY_CODE } from "@/lib/countries";

interface Period {
  id: number; name: string; startDate: string; endDate: string;
  tipPool: string; status: "draft" | "paid"; totalBase: string; totalTip: string;
}
interface Line {
  userId: number; name: string; duty: string | null;
  payType: "monthly" | "hourly"; hours: string; monthlyAmount: string;
  hourlyRate: string; basePay: string; tipAmount: string; note: string | null;
}
interface Detail {
  id: number; name: string; startDate: string; endDate: string;
  tipPool: number; status: "draft" | "paid"; lines: Line[];
}

function num(v: string | number) { return Number(v) || 0; }

function PayrollContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [storeId, setStoreId] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // create form
  const [showCreate, setShowCreate] = useState(false);
  const [cName, setCName] = useState("");
  const [cStart, setCStart] = useState("");
  const [cEnd, setCEnd] = useState("");
  const [cTip, setCTip] = useState("");

  // editor working copy
  const [rows, setRows] = useState<Line[]>([]);
  const [tipPool, setTipPool] = useState("0");

  const loadPeriods = useCallback(async (sid: string) => {
    const res = await fetch(`/api/payroll?storeId=${sid}`);
    if (res.ok) setPeriods(await res.json());
  }, []);

  useEffect(() => {
    async function init() {
      let sid = searchParams.get("storeId");
      if (!sid) {
        const stores = await fetch("/api/stores").then(r => r.ok ? r.json() : []);
        if (stores[0]?.id) sid = String(stores[0].id);
      }
      if (!sid) { setLoading(false); setMounted(true); return; }
      setStoreId(sid);
      const storeRes = await fetch(`/api/stores/${sid}`);
      if (storeRes.ok) { const s = await storeRes.json(); if (s?.country) setCountry(s.country); }
      await loadPeriods(sid);
      setLoading(false); setMounted(true);
    }
    init();
  }, [searchParams, loadPeriods]);

  const openPeriod = async (id: number) => {
    setErr("");
    const res = await fetch(`/api/payroll/${id}`);
    if (!res.ok) { setErr("โหลดงวดไม่สำเร็จ"); return; }
    const d: Detail = await res.json();
    setDetail(d);
    setTipPool(String(d.tipPool));
    setRows(d.lines.map(l => ({ ...l })));
  };

  const createPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    const res = await fetch("/api/payroll", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, name: cName, startDate: cStart, endDate: cEnd, tipPool: num(cTip) }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(data.error || "สร้างไม่สำเร็จ");
    setShowCreate(false); setCName(""); setCStart(""); setCEnd(""); setCTip("");
    await loadPeriods(storeId);
    openPeriod(data.id);
  };

  // ---- live compute ในตัวแก้ไข (ให้เห็นผลก่อนบันทึก) ----
  const totalHours = rows.reduce((s, r) => s + num(r.hours), 0);
  const pool = num(tipPool);
  const preview = rows.map(r => {
    const base = r.payType === "hourly" ? num(r.hourlyRate) * num(r.hours) : num(r.monthlyAmount);
    const tip = totalHours > 0 ? (num(r.hours) / totalHours) * pool : 0;
    return { base, tip, total: base + tip };
  });
  const sumBase = preview.reduce((s, p) => s + p.base, 0);
  const sumTip = preview.reduce((s, p) => s + p.tip, 0);

  const setRow = (i: number, patch: Partial<Line>) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const save = async (action: "save" | "finalize") => {
    if (!detail) return;
    if (action === "finalize" && !window.confirm(`ปิดจ่ายงวดนี้? เงินเดือนรวม ${formatCurrency(sumBase, country)} จะลงบัญชีเป็นรายจ่าย (ทิปไม่ลงบัญชี)`)) return;
    setBusy(true); setErr("");
    const res = await fetch(`/api/payroll/${detail.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action, tipPool: pool,
        lines: rows.map(r => ({
          userId: r.userId, payType: r.payType, hours: num(r.hours),
          monthlyAmount: num(r.monthlyAmount), hourlyRate: num(r.hourlyRate), note: r.note,
        })),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(data.error || "บันทึกไม่สำเร็จ");
    await loadPeriods(storeId);
    openPeriod(detail.id);
  };

  const reopen = async () => {
    if (!detail || !window.confirm("เปิดงวดนี้แก้ใหม่? รายการเงินเดือนในบัญชีจะถูกถอนออกก่อน")) return;
    setBusy(true);
    await fetch(`/api/payroll/${detail.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reopen" }),
    });
    setBusy(false);
    await loadPeriods(storeId);
    openPeriod(detail.id);
  };

  const removePeriod = async () => {
    if (!detail || !window.confirm("ลบงวดนี้ทั้งหมด? (ถ้าปิดจ่ายแล้ว รายการบัญชีจะถูกถอนคืน)")) return;
    setBusy(true);
    await fetch(`/api/payroll/${detail.id}`, { method: "DELETE" });
    setBusy(false);
    setDetail(null);
    await loadPeriods(storeId);
  };

  if (!mounted) return null;
  const q = storeId ? `?storeId=${storeId}` : "";
  const locked = detail?.status === "paid";

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-16">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => detail ? setDetail(null) : router.push(`/dashboard${q}`)}
              className="w-9 h-9 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7" /></svg>
            </button>
            <p className="text-base font-semibold text-gray-900">{detail ? detail.name : "เงินเดือน & ทิป"}</p>
          </div>
          {!detail && (
            <button onClick={() => setShowCreate(true)} className="rounded-xl bg-black text-white text-sm font-bold px-4 py-2 hover:bg-gray-800">+ งวดใหม่</button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6 flex flex-col gap-4">
        {err && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{err}</p>}

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">กำลังโหลด...</div>
        ) : detail ? (
          <>
            {/* กองทิป */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-gray-800">กองทิป (Tip box) ของงวดนี้</p>
                <p className="text-[11px] text-gray-400">แบ่งให้พนักงานตามชั่วโมงทำงานอัตโนมัติ · รวมชั่วโมง {totalHours}</p>
              </div>
              <input type="number" min={0} step="1" value={tipPool} disabled={locked}
                onChange={e => setTipPool(e.target.value)}
                className="w-36 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-right outline-none focus:border-black focus:bg-white disabled:opacity-60" />
            </div>

            {/* ตารางพนักงาน */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                      <th className="px-3 py-3 text-left">พนักงาน</th>
                      <th className="px-3 py-3">ประเภท</th>
                      <th className="px-3 py-3 text-right">เรต/เดือน</th>
                      <th className="px-3 py-3 text-right">ชั่วโมง</th>
                      <th className="px-3 py-3 text-right">เงินเดือน</th>
                      <th className="px-3 py-3 text-right">ทิป</th>
                      <th className="px-3 py-3 text-right">รวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((r, i) => (
                      <tr key={r.userId} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2">
                          <p className="font-semibold text-gray-800 text-xs">{r.name}</p>
                          {r.duty && <p className="text-[10px] text-gray-400">{r.duty}</p>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <select value={r.payType} disabled={locked}
                            onChange={e => setRow(i, { payType: e.target.value as "monthly" | "hourly" })}
                            className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white outline-none focus:border-black disabled:opacity-60">
                            <option value="monthly">รายเดือน</option>
                            <option value="hourly">รายชั่วโมง</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.payType === "hourly" ? (
                            <input type="number" min={0} value={r.hourlyRate} disabled={locked}
                              onChange={e => setRow(i, { hourlyRate: e.target.value })}
                              className="w-20 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-right outline-none focus:border-black focus:bg-white disabled:opacity-60" />
                          ) : (
                            <input type="number" min={0} value={r.monthlyAmount} disabled={locked}
                              onChange={e => setRow(i, { monthlyAmount: e.target.value })}
                              className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-right outline-none focus:border-black focus:bg-white disabled:opacity-60" />
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input type="number" min={0} step="0.5" value={r.hours} disabled={locked}
                            onChange={e => setRow(i, { hours: e.target.value })}
                            className="w-16 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-right outline-none focus:border-black focus:bg-white disabled:opacity-60" />
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">{formatCurrency(preview[i].base, country)}</td>
                        <td className="px-3 py-2 text-right text-emerald-600 text-xs">{formatCurrency(preview[i].tip, country)}</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-900 text-xs">{formatCurrency(preview[i].total, country)}</td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400 text-xs">ยังไม่มีพนักงานในร้านนี้</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-100 bg-gray-50/70 font-bold text-gray-800 text-xs">
                      <td className="px-3 py-3" colSpan={4}>รวมทั้งงวด</td>
                      <td className="px-3 py-3 text-right">{formatCurrency(sumBase, country)}</td>
                      <td className="px-3 py-3 text-right text-emerald-600">{formatCurrency(sumTip, country)}</td>
                      <td className="px-3 py-3 text-right">{formatCurrency(sumBase + sumTip, country)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ปุ่ม */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button onClick={removePeriod} disabled={busy}
                className="rounded-xl border border-red-200 text-red-600 text-sm font-semibold px-3 py-2.5 hover:bg-red-50 disabled:opacity-40">ลบงวด</button>
              <div className="flex gap-2">
                {locked ? (
                  <>
                    <span className="self-center text-xs font-bold text-emerald-600">✓ ปิดจ่ายแล้ว (เงินเดือนลงบัญชี)</span>
                    <button onClick={reopen} disabled={busy}
                      className="rounded-xl border border-gray-300 text-gray-700 text-sm font-bold px-4 py-2.5 hover:border-black disabled:opacity-40">เปิดแก้ใหม่</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => save("save")} disabled={busy}
                      className="rounded-xl border border-gray-300 text-gray-700 text-sm font-bold px-4 py-2.5 hover:border-black disabled:opacity-40">บันทึกร่าง</button>
                    <button onClick={() => save("finalize")} disabled={busy}
                      className="rounded-xl bg-black text-white text-sm font-bold px-5 py-2.5 hover:bg-gray-800 disabled:opacity-50">ปิดจ่าย + ลงบัญชี</button>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            {periods.length === 0 ? (
              <div className="text-center py-16 text-sm text-gray-400">ยังไม่มีงวดเงินเดือน — กด &quot;+ งวดใหม่&quot; เพื่อเริ่ม</div>
            ) : periods.map(p => (
              <button key={p.id} onClick={() => openPeriod(p.id)}
                className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between text-left hover:border-gray-300 transition-all">
                <div>
                  <p className="text-sm font-bold text-gray-800">{p.name}
                    {p.status === "paid"
                      ? <span className="ml-2 inline-flex rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">ปิดจ่ายแล้ว</span>
                      : <span className="ml-2 inline-flex rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">ร่าง</span>}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{p.startDate} – {p.endDate}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(num(p.totalBase), country)}</p>
                  <p className="text-[11px] text-emerald-600">ทิป {formatCurrency(num(p.totalTip), country)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <form onSubmit={createPeriod} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <p className="font-bold text-gray-900 text-lg mb-4">งวดเงินเดือนใหม่</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">ชื่องวด</label>
                <input type="text" value={cName} onChange={e => setCName(e.target.value)} placeholder="เช่น เงินเดือน ก.ค. 2569" required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-black focus:bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">ตั้งแต่</label>
                  <input type="date" value={cStart} onChange={e => setCStart(e.target.value)} required
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-black focus:bg-white" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">ถึง</label>
                  <input type="date" value={cEnd} onChange={e => setCEnd(e.target.value)} required
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-black focus:bg-white" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">กองทิป (ใส่ทีหลังได้)</label>
                <input type="number" min={0} value={cTip} onChange={e => setCTip(e.target.value)} placeholder="0"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-black focus:bg-white" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:border-gray-400">ยกเลิก</button>
              <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-black text-white py-2.5 text-sm font-bold hover:bg-gray-800 disabled:opacity-50">สร้าง</button>
            </div>
          </form>
        </div>
      )}

      {!detail && periods.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 mt-4">
          <p className="text-[11px] text-gray-400">เรต/เงินเดือนที่กรอกในงวดจะถูกจำไว้เป็นค่าตั้งต้นของงวดถัดไปอัตโนมัติ</p>
        </div>
      )}
    </div>
  );
}

export default function PayrollPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">กำลังโหลด...</div>}>
      <PayrollContent />
    </Suspense>
  );
}
