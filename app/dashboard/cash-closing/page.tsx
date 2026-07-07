"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PinBoxes from "@/components/PinBoxes";
import { formatCurrency } from "@/lib/currency";
import { DEFAULT_COUNTRY_CODE } from "@/lib/countries";

interface Shift {
  id: number;
  name: string;
  start_time: string;
  end_time: string | null;
  color: string;
}

interface Withdrawal {
  id: number;
  amount: string;
  reason: string;
  employeeName: string | null;
  createdAt: string;
}

interface ExpectedData {
  businessDate: string;
  shift: Shift | null;
  shifts: Shift[];
  openingFloat: number;
  withdrawals: Withdrawal[];
  withdrawalsTotal: number;
}

const DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 2, 1];

const REASONS = [
  { code: "wrong_change", label: "ทอนเงินผิด" },
  { code: "missed_withdrawal_log", label: "ลืมบันทึกเบิก" },
  { code: "counterfeit_damaged", label: "เงินปลอม-ชำรุด" },
  { code: "other", label: "อื่นๆ" },
];

function CashClosingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [storeId, setStoreId] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<ExpectedData | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [withdrawalsExpanded, setWithdrawalsExpanded] = useState(false);

  const [cashSales, setCashSales] = useState("");
  const [countMethod, setCountMethod] = useState<"quick" | "detailed">("quick");
  const [quickCounted, setQuickCounted] = useState("");
  const [denomQty, setDenomQty] = useState<Record<number, number>>({});
  const [discrepancyReason, setDiscrepancyReason] = useState<string | null>(null);
  const [discrepancyNote, setDiscrepancyNote] = useState("");

  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState(["", "", "", ""]);
  const [pinError, setPinError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    async function load() {
      let sid = searchParams.get("storeId");
      if (!sid) {
        const r = await fetch("/api/stores");
        if (r.ok) {
          const stores = await r.json();
          if (stores[0]?.id) sid = String(stores[0].id);
        }
      }
      if (!sid) {
        const me = await fetch("/api/auth/me").then(r => r.ok ? r.json() : null);
        if (me?.user?.storeId) sid = String(me.user.storeId);
      }
      if (!sid) { setLoading(false); setMounted(true); return; }
      setStoreId(sid);

      const storeRes = await fetch(`/api/stores/${sid}`);
      if (storeRes.ok) {
        const store = await storeRes.json();
        if (store?.country) setCountry(store.country);
      }

      const res = await fetch(`/api/cash-closings/current-expected?storeId=${sid}`);
      if (res.ok) {
        const d: ExpectedData = await res.json();
        setData(d);
        setSelectedShiftId(d.shift?.id ?? null);
      }
      setLoading(false);
      setMounted(true);
    }
    load();
  }, [searchParams]);

  const countedAmount = countMethod === "quick"
    ? Number(quickCounted) || 0
    : DENOMINATIONS.reduce((sum, d) => sum + d * (denomQty[d] || 0), 0);

  const expectedAmount = data ? data.openingFloat + (Number(cashSales) || 0) - data.withdrawalsTotal : 0;
  const difference = countedAmount - expectedAmount;
  const hasCounted = countMethod === "quick" ? quickCounted !== "" : Object.values(denomQty).some(q => q > 0);

  const selectedShift = data?.shifts.find(s => s.id === selectedShiftId) ?? null;

  const openPin = () => {
    if (!hasCounted) return;
    setPin(["", "", "", ""]);
    setPinError("");
    setSavedOk(false);
    setPinOpen(true);
  };

  const handleSubmit = async () => {
    const pinStr = pin.join("");
    if (pinStr.length !== 4) { setPinError("กรุณากรอก PIN 4 หลัก"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/cash-closings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          shiftId: selectedShiftId,
          cashSales: Number(cashSales) || 0,
          countedAmount,
          countMethod,
          denominationBreakdown: countMethod === "detailed" ? denomQty : null,
          discrepancyReason: difference !== 0 ? discrepancyReason : null,
          discrepancyNote: difference !== 0 ? discrepancyNote : null,
          pin: pinStr,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setPinError(err.error || "เกิดข้อผิดพลาด");
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      setSavedOk(true);
      setTimeout(() => { router.push("/dashboard"); }, 1400);
    } catch {
      setPinError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-emerald-50/40 font-sans pb-32">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <p className="text-base font-semibold text-gray-900">ปิดยอดเงินสด</p>
            <p className="text-xs text-gray-400">
              {selectedShift
                ? `${selectedShift.name} (${selectedShift.start_time.slice(0, 5)}${selectedShift.end_time ? `–${selectedShift.end_time.slice(0, 5)}` : ""})`
                : "ยังไม่ระบุกะ"}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">กำลังโหลด...</div>
      ) : !data ? (
        <div className="text-center py-16 text-sm text-gray-400">ไม่พบร้านค้า</div>
      ) : (
        <div className="max-w-lg mx-auto px-4 pt-4 flex flex-col gap-4">

          {/* กะ */}
          {data.shifts.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <label className="text-xs font-semibold text-gray-500 block mb-1.5">กะที่ปิดยอด</label>
              <select
                value={selectedShiftId ?? ""}
                onChange={e => setSelectedShiftId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:bg-white transition-all"
              >
                <option value="">-- เลือกกะ --</option>
                {data.shifts.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.start_time.slice(0, 5)}{s.end_time ? `–${s.end_time.slice(0, 5)}` : ""})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ข้อมูลอัตโนมัติ */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">เงินทอนสำรองต้นกะ</span>
              <span className="text-sm font-bold text-gray-900">{formatCurrency(data.openingFloat, country)}</span>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setWithdrawalsExpanded(v => !v)}
                className="w-full flex items-center justify-between"
              >
                <span className="text-sm text-gray-500">
                  เบิกเงินระหว่างกะ ({data.withdrawals.length} รายการ)
                </span>
                <span className="text-sm font-bold text-red-500">−{formatCurrency(data.withdrawalsTotal, country)}</span>
              </button>
              {withdrawalsExpanded && data.withdrawals.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5 border-t border-gray-100 pt-2">
                  {data.withdrawals.map(w => (
                    <div key={w.id} className="flex items-center justify-between text-xs text-gray-400">
                      <span>
                        {new Date(w.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}{" "}
                        {w.reason} ({w.employeeName ?? "-"})
                      </span>
                      <span className="text-red-400 font-medium">−{formatCurrency(Number(w.amount), country)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">ยอดขายเงินสดรวม</label>
              <input
                type="number" inputMode="decimal" min="0" step="0.01" placeholder="0"
                value={cashSales} onChange={e => setCashSales(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:bg-white transition-all"
              />
              <p className="text-[11px] text-gray-400 mt-1">กรอกยอดขายเงินสดของกะนี้เอง (ระบบยังไม่เชื่อมกับ POS)</p>
            </div>
          </div>

          {/* นับเงินจริง */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
            <div className="flex gap-2">
              {(["quick", "detailed"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCountMethod(m)}
                  className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-all ${
                    countMethod === m ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {m === "quick" ? "นับเร็ว" : "นับละเอียด"}
                </button>
              ))}
            </div>

            {countMethod === "quick" ? (
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">ยอดที่นับได้ (รวม)</label>
                <input
                  type="number" inputMode="decimal" min="0" step="0.01" placeholder="0"
                  value={quickCounted} onChange={e => setQuickCounted(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-lg font-semibold text-center outline-none focus:border-emerald-400 focus:bg-white transition-all"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {DENOMINATIONS.map(d => (
                  <div key={d} className="flex items-center gap-3">
                    <span className="w-14 text-sm font-semibold text-gray-700">{d}</span>
                    <button type="button"
                      onClick={() => setDenomQty(p => ({ ...p, [d]: Math.max(0, (p[d] || 0) - 1) }))}
                      className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold">−</button>
                    <input
                      type="number" min="0" value={denomQty[d] || 0}
                      onChange={e => setDenomQty(p => ({ ...p, [d]: Math.max(0, Number(e.target.value) || 0) }))}
                      className="w-14 text-center rounded-lg border border-gray-200 bg-gray-50 py-1 text-sm outline-none"
                    />
                    <button type="button"
                      onClick={() => setDenomQty(p => ({ ...p, [d]: (p[d] || 0) + 1 }))}
                      className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold">+</button>
                    <span className="ml-auto text-sm text-gray-400">{formatCurrency(d * (denomQty[d] || 0), country)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-1">
                  <span className="text-sm font-semibold text-gray-700">รวมทั้งหมด</span>
                  <span className="text-base font-bold text-gray-900">{formatCurrency(countedAmount, country)}</span>
                </div>
              </div>
            )}
          </div>

          {/* ผลต่าง */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>ยอดที่ควรมี</span>
              <span className="font-semibold text-gray-700">{formatCurrency(expectedAmount, country)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">ผลต่าง</span>
              {!hasCounted ? (
                <span className="text-sm text-gray-300">—</span>
              ) : difference === 0 ? (
                <span className="text-base font-bold text-emerald-600">ยอดตรงเป๊ะ!</span>
              ) : (
                <span className={`text-base font-bold ${difference > 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {difference > 0 ? "+" : "-"}{formatCurrency(Math.abs(difference), country)} ({difference > 0 ? "ยอดเกิน" : "ยอดขาด"})
                </span>
              )}
            </div>
          </div>

          {/* เหตุผล */}
          {hasCounted && difference !== 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
              <label className="text-xs font-semibold text-gray-500">เหตุผลที่ยอดไม่ตรง</label>
              <div className="flex flex-wrap gap-2">
                {REASONS.map(r => (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => setDiscrepancyReason(r.code)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                      discrepancyReason === r.code ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {discrepancyReason === "other" && (
                <textarea
                  value={discrepancyNote} onChange={e => setDiscrepancyNote(e.target.value)}
                  placeholder="อธิบายเพิ่มเติม (ถ้ามี)"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:bg-white transition-all resize-none"
                  rows={2}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Submit button */}
      {data && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-100 px-4 py-4">
          <div className="max-w-lg mx-auto">
            <button
              onClick={openPin}
              disabled={!hasCounted}
              className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm py-4 transition-all"
            >
              ยืนยันปิดยอด
            </button>
          </div>
        </div>
      )}

      {/* PIN Bottom Sheet */}
      {pinOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget && !submitting) setPinOpen(false); }}
        >
          <div className="bg-white w-full max-w-sm rounded-t-3xl px-6 pt-6 pb-10">
            {savedOk ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-base font-bold text-green-700">ปิดยอดสำเร็จ!</p>
              </div>
            ) : (
              <>
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
                <p className="text-base font-semibold text-gray-900 text-center mb-1">ยืนยันตัวตน</p>
                <p className="text-xs text-gray-400 text-center mb-6">กรอก PIN พนักงานเพื่อยืนยันการปิดยอด</p>

                <PinBoxes value={pin} onChange={v => { setPin(v); setPinError(""); }} autoFocus />

                {pinError && (
                  <p className="text-xs text-red-500 text-center mt-3">{pinError}</p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting || pin.join("").length !== 4}
                  className="mt-6 w-full rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm py-4 transition-all"
                >
                  {submitting ? "กำลังบันทึก..." : "ยืนยัน"}
                </button>
                <button
                  onClick={() => setPinOpen(false)}
                  disabled={submitting}
                  className="mt-2 w-full py-2 text-sm text-gray-400 hover:text-gray-600"
                >
                  ยกเลิก
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CashClosingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">กำลังโหลด...</div>}>
      <CashClosingContent />
    </Suspense>
  );
}
