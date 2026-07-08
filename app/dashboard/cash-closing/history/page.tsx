"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useT, LangSwitcher } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { DEFAULT_COUNTRY_CODE } from "@/lib/countries";
import PasswordInput from "@/components/PasswordInput";

interface ClosingRow {
  id: number;
  businessDate: string;
  countedAmount: string;
  openingFloat: string;
  withdrawalsTotal: string;
  countMethod: "quick" | "detailed";
  difference: string;
  discrepancyReason: string | null;
  discrepancyNote: string | null;
  createdAt: string;
  scheduleMismatch: boolean;
  acknowledgedAt: string | null;
  editHistory: unknown[] | null;
  shiftId: number | null;
  shiftName: string | null;
  closedByName: string | null;
  acknowledgedByName: string | null;
}

const REASONS = [
  { code: "wrong_change", label: "ทอนเงินผิด" },
  { code: "missed_withdrawal_log", label: "ลืมบันทึกเบิก" },
  { code: "counterfeit_damaged", label: "เงินปลอม-ชำรุด" },
  { code: "other", label: "อื่นๆ" },
];

interface ShiftStat {
  shiftId: number | null;
  shiftName: string;
  count: number;
  shortCount: number;
  overCount: number;
  totalAbsDiff: number;
}

function summarizeByShift(rows: ClosingRow[]): ShiftStat[] {
  const map = new Map<string, ShiftStat>();
  for (const r of rows) {
    const key = String(r.shiftId ?? "none");
    const stat = map.get(key) ?? {
      shiftId: r.shiftId, shiftName: r.shiftName ?? "-", count: 0, shortCount: 0, overCount: 0, totalAbsDiff: 0,
    };
    stat.count += 1;
    const diff = Number(r.difference);
    if (diff < 0) stat.shortCount += 1;
    if (diff > 0) stat.overCount += 1;
    stat.totalAbsDiff += Math.abs(diff);
    map.set(key, stat);
  }
  return Array.from(map.values()).sort((a, b) => (b.shortCount + b.overCount) - (a.shortCount + a.overCount));
}

function CashClosingHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useT();

  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE);
  const [rows, setRows] = useState<ClosingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [storeId, setStoreId] = useState("");

  const [editRow, setEditRow] = useState<ClosingRow | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editReason, setEditReason] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  async function load(sid: string) {
    const [storeRes, historyRes] = await Promise.all([
      fetch(`/api/stores/${sid}`),
      fetch(`/api/cash-closings/history?storeId=${sid}`),
    ]);
    if (storeRes.ok) {
      const store = await storeRes.json();
      if (store?.country) setCountry(store.country);
    }
    if (historyRes.ok) setRows(await historyRes.json());
  }

  useEffect(() => {
    async function init() {
      let sid = searchParams.get("storeId");
      if (!sid) {
        const me = await fetch("/api/auth/me").then(r => r.ok ? r.json() : null);
        if (me?.user?.storeId) sid = String(me.user.storeId);
      }
      if (!sid) {
        const stores = await fetch("/api/stores").then(r => r.ok ? r.json() : []);
        if (stores[0]?.id) sid = String(stores[0].id);
      }
      if (!sid) { setLoading(false); setMounted(true); return; }
      setStoreId(sid);
      await load(sid);
      setLoading(false);
      setMounted(true);
    }
    init();
  }, [searchParams]);

  const openEdit = (row: ClosingRow) => {
    setEditRow(row);
    setEditAmount(String(Number(row.countedAmount)));
    setEditReason(row.discrepancyReason);
    setEditNote(row.discrepancyNote ?? "");
    setEditPassword("");
    setEditError("");
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRow || saving) return;
    setEditError("");
    if (!editAmount || Number(editAmount) < 0) return setEditError("กรุณากรอกยอดที่นับได้");
    if (!editPassword) return setEditError("กรุณายืนยันรหัสผ่านก่อนบันทึก");

    setSaving(true);
    const res = await fetch(`/api/cash-closings/${editRow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countedAmount: Number(editAmount),
        countMethod: editRow.countMethod,
        discrepancyReason: editReason,
        discrepancyNote: editNote || null,
        password: editPassword,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setEditError(data.error);

    setEditRow(null);
    if (storeId) await load(storeId);
  };

  const acknowledgeRow = async () => {
    if (!editRow || saving) return;
    setSaving(true);
    const res = await fetch(`/api/cash-closings/${editRow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acknowledge: true }),
    });
    setSaving(false);
    if (!res.ok) return setEditError(t("error"));

    setEditRow(null);
    if (storeId) await load(storeId);
  };

  if (!mounted) return null;

  const shiftStats = summarizeByShift(rows);

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-16">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <p className="text-base font-semibold text-gray-900">{t("cashClosingHistoryTitle")}</p>
          </div>
          <LangSwitcher />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 flex flex-col gap-6">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">กำลังโหลด...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-sm text-gray-400">{t("noCashClosingHistory")}</div>
        ) : (
          <>
            {/* สรุปตามกะ */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm font-bold text-gray-800 mb-4">{t("shiftPerformanceTitle")}</p>
              <div className="flex flex-col gap-2">
                {shiftStats.map(s => (
                  <div key={s.shiftId ?? "none"} className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                    <div>
                      <p className="text-xs font-bold text-gray-800">{s.shiftName}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {s.count} {t("closingsCountLabel")} · {s.shortCount} {t("shortCountLabel")} · {s.overCount} {t("overCountLabel")}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-gray-700 shrink-0">
                      {t("totalDiscrepancyLabel")} {formatCurrency(s.totalAbsDiff, country)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* รายการล่าสุด */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm font-bold text-gray-800 mb-4">{t("cashClosingHistoryTitle")}</p>
              <div className="flex flex-col gap-2">
                {rows.map(r => {
                  const diff = Number(r.difference);
                  // ยอดที่กะนี้ทำได้เอง (นับแบบสะสมทั้งลิ้นชัก จึงต้องหักยอดตั้งต้นและบวกเงินที่เบิกออก)
                  const shiftCash = Number(r.countedAmount) - Number(r.openingFloat) + Number(r.withdrawalsTotal);
                  return (
                    <button
                      key={r.id}
                      onClick={() => openEdit(r)}
                      className="flex items-center justify-between gap-3 border-b border-gray-50 last:border-0 pb-2.5 last:pb-0 text-left hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-all"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">
                          {r.businessDate.slice(0, 10)} · {r.shiftName ?? "-"} · {r.closedByName ?? "-"}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {t("shiftCashLabel")}: <span className="font-bold text-gray-600">{formatCurrency(shiftCash, country)}</span>
                          {" · "}{t("countedTotalLabel")}: {formatCurrency(Number(r.countedAmount), country)}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {r.scheduleMismatch && (
                            <span className="inline-flex rounded-full bg-orange-50 border border-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-600">
                              {t("scheduleMismatchLabel")}
                            </span>
                          )}
                          {r.editHistory && r.editHistory.length > 0 && (
                            <span className="inline-flex rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                              {t("editedLabel")}
                            </span>
                          )}
                          {r.acknowledgedAt && (
                            <span className="inline-flex rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                              {t("acknowledgedLabel")}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-bold shrink-0 ${diff === 0 ? "text-gray-400" : diff > 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {diff === 0 ? "—" : `${diff > 0 ? "+" : "-"}${formatCurrency(Math.abs(diff), country)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editRow && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setEditRow(null); }}>
          <form onSubmit={submitEdit} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="font-bold text-gray-900 text-lg">แก้ไขรายการปิดยอด</p>
              <button type="button" onClick={() => setEditRow(null)} className="text-gray-400 hover:text-black text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">✕</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">{editRow.businessDate.slice(0, 10)} · {editRow.shiftName ?? "-"}</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">ยอดที่นับได้ (แก้ไข)</label>
                <input type="number" inputMode="decimal" min="0" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-lg font-semibold text-center outline-none focus:border-black focus:bg-white transition-all" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-2">เหตุผลที่แก้ไข</label>
                <div className="flex flex-wrap gap-2">
                  {REASONS.map(r => (
                    <button key={r.code} type="button" onClick={() => setEditReason(r.code)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${editReason === r.code ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">โน้ต</label>
                <textarea value={editNote} onChange={e => setEditNote(e.target.value)} rows={2}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all resize-none" />
              </div>
              <div className="pt-2 border-t border-gray-100">
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">ยืนยันรหัสผ่านก่อนบันทึก</label>
                <PasswordInput value={editPassword} onChange={setEditPassword} placeholder="รหัสผ่าน" required autoComplete="current-password" />
              </div>
            </div>

            {editError && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mt-4">{editError}</p>}

            {!editRow.acknowledgedAt && (editRow.scheduleMismatch || Number(editRow.difference) !== 0) && (
              <button type="button" onClick={acknowledgeRow} disabled={saving}
                className="w-full mt-4 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 hover:border-emerald-400 transition-all disabled:opacity-50">
                {t("acknowledgeBtn")}
              </button>
            )}

            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => setEditRow(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:border-gray-400 transition-all">
                ยกเลิก
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 rounded-xl bg-black py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-all disabled:bg-gray-200 disabled:text-gray-400">
                {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function CashClosingHistoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">กำลังโหลด...</div>}>
      <CashClosingHistoryContent />
    </Suspense>
  );
}
