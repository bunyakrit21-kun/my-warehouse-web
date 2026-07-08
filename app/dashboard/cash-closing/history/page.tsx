"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
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
  isDayClose: boolean;
  acknowledgedAt: string | null;
  editHistory: unknown[] | null;
  shiftId: number | null;
  shiftName: string | null;
  closedByName: string | null;
  acknowledgedByName: string | null;
}

interface ShiftConfig {
  id: number;
  name: string;
  startTime: string;
  endTime: string | null;
  color: string | null;
}

interface ScheduleEntry {
  workDate: string;
  shiftId: number;
  name: string;
}

interface Overview {
  month: string;
  shifts: ShiftConfig[];
  closings: ClosingRow[];
  schedule: ScheduleEntry[];
}

const REASONS = [
  { code: "wrong_change", label: "ทอนเงินผิด" },
  { code: "missed_withdrawal_log", label: "ลืมบันทึกเบิก" },
  { code: "counterfeit_damaged", label: "เงินปลอม-ชำรุด" },
  { code: "other", label: "อื่นๆ" },
];

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function currentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const shiftCashOf = (r: ClosingRow) =>
  Number(r.countedAmount) - Number(r.openingFloat) + Number(r.withdrawalsTotal);

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

/** สถานะของวัน: closed = ปิดร้านแล้ว, partial = ปิดบางกะ, missed = วันที่ผ่านแล้วแต่ไม่มีการปิดเลย */
type DayStatus = "closed" | "partial" | "missed" | "future" | "empty";

function CashClosingHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useT();

  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [month, setMonth] = useState(currentMonthStr());
  const [view, setView] = useState<"days" | "calendar">("days");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [storeId, setStoreId] = useState("");

  const [editRow, setEditRow] = useState<ClosingRow | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editReason, setEditReason] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const load = useCallback(async (sid: string, m: string) => {
    const res = await fetch(`/api/cash-closings/overview?storeId=${sid}&month=${m}`);
    if (res.ok) setOverview(await res.json());
  }, []);

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
      const storeRes = await fetch(`/api/stores/${sid}`);
      if (storeRes.ok) {
        const store = await storeRes.json();
        if (store?.country) setCountry(store.country);
      }
      await load(sid, currentMonthStr());
      setLoading(false);
      setMounted(true);
    }
    init();
  }, [searchParams, load]);

  const changeMonth = async (delta: number) => {
    const m = shiftMonth(month, delta);
    setMonth(m);
    setSelectedDay(null);
    if (storeId) { setLoading(true); await load(storeId, m); setLoading(false); }
  };

  const openEdit = (row: ClosingRow) => {
    setEditRow(row);
    setEditAmount(String(Number(row.countedAmount)));
    setEditDate(row.businessDate.slice(0, 10));
    setEditReason(row.discrepancyReason);
    setEditNote(row.discrepancyNote ?? "");
    setEditPassword("");
    setEditError("");
  };

  const refresh = async () => { if (storeId) await load(storeId, month); };

  const deleteClosing = async () => {
    if (!editRow || saving) return;
    setEditError("");
    if (!editPassword) return setEditError("กรุณายืนยันรหัสผ่านก่อนลบ");
    if (!window.confirm("ยืนยันลบรายการปิดยอดนี้? รายการบัญชีที่ผูกอยู่จะถูกย้อนคืนอัตโนมัติ (ลบได้เฉพาะรายการล่าสุด)")) return;
    setSaving(true);
    const res = await fetch(`/api/cash-closings/${editRow.id}`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: editPassword }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setEditError(data.error || "เกิดข้อผิดพลาด");
    setEditRow(null);
    await refresh();
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
        businessDate: editDate,
        password: editPassword,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setEditError(data.error);

    setEditRow(null);
    await refresh();
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
    await refresh();
  };

  if (!mounted) return null;

  // ---------- จัดกลุ่มข้อมูลตามวันทำการ ----------
  const closings = overview?.closings ?? [];
  const shifts = overview?.shifts ?? [];
  const schedule = overview?.schedule ?? [];

  const byDay = new Map<string, ClosingRow[]>();
  for (const c of closings) {
    const key = c.businessDate.slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), c]);
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const [yy, mm] = month.split("-").map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const firstClosingDay = closings.length > 0 ? closings.map(c => c.businessDate.slice(0, 10)).sort()[0] : null;

  const dayStatus = (dateStr: string): DayStatus => {
    const list = byDay.get(dateStr);
    if (list && list.length > 0) return list.some(c => c.isDayClose) ? "closed" : "partial";
    if (dateStr >= todayStr) return "future";
    // วันในอดีตที่ไม่มีการปิดเลย — นับเป็น "พลาด" เฉพาะช่วงที่ร้านเริ่มใช้ระบบแล้ว
    if (firstClosingDay && dateStr >= firstClosingDay) return "missed";
    return "empty";
  };

  // วันที่จะแสดงเป็นการ์ด: วันที่มีข้อมูล + วันที่พลาด (ใหม่→เก่า)
  const cardDays: string[] = [];
  for (let d = daysInMonth; d >= 1; d--) {
    const ds = `${month}-${String(d).padStart(2, "0")}`;
    const st = dayStatus(ds);
    if (st === "closed" || st === "partial" || st === "missed") cardDays.push(ds);
  }

  const scheduleFor = (dateStr: string, shiftId: number) =>
    schedule.filter(s => s.workDate.slice(0, 10) === dateStr && s.shiftId === shiftId).map(s => s.name);

  const STATUS_DOT: Record<DayStatus, string> = {
    closed: "bg-emerald-500", partial: "bg-amber-400", missed: "bg-red-400", future: "bg-gray-100", empty: "bg-gray-100",
  };

  const renderDayCard = (ds: string) => {
    const list = byDay.get(ds) ?? [];
    const isDayClosed = list.some(c => c.isDayClose);
    const dayTotal = list.reduce((sum, c) => sum + shiftCashOf(c), 0);
    const dateObj = new Date(`${ds}T00:00:00`);
    const label = `${WEEKDAYS[dateObj.getDay()]}. ${dateObj.getDate()} ${THAI_MONTHS[dateObj.getMonth()]}`;

    // กะที่ปิดแล้ว เรียงตามเวลาบันทึก + กะที่ตั้งไว้แต่ยังไม่ปิด (เฉพาะวันที่ผ่านแล้ว)
    const closedShiftIds = new Set(list.map(c => c.shiftId));
    const missingShifts = ds < todayStr ? shifts.filter(s => !closedShiftIds.has(s.id)) : [];

    return (
      <div key={ds} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[dayStatus(ds)]}`} />
            <p className="text-sm font-bold text-gray-800">{label}</p>
            {isDayClosed && (
              <span className="inline-flex rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                ปิดร้านแล้ว
              </span>
            )}
          </div>
          {list.length > 0 && (
            <p className="text-xs font-bold text-gray-700">{formatCurrency(dayTotal, country)}</p>
          )}
        </div>
        <div className="flex flex-col">
          {list.length === 0 && (
            <p className="px-4 py-3 text-xs text-red-500 font-semibold">ไม่มีการปิดยอดวันนี้</p>
          )}
          {list.map(c => {
            const diff = Number(c.difference);
            return (
              <button key={c.id} onClick={() => openEdit(c)}
                className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 text-left hover:bg-gray-50 transition-all">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">
                    {c.shiftName ?? "ไม่ระบุกะ"}{c.isDayClose ? " · ปิดร้าน" : ""} · {c.closedByName ?? "-"}
                    <span className="font-normal text-gray-400"> · {new Date(c.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.</span>
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {t("shiftCashLabel")}: <span className="font-bold text-gray-600">{formatCurrency(shiftCashOf(c), country)}</span>
                    {" · "}{t("countedTotalLabel")}: {formatCurrency(Number(c.countedAmount), country)}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {c.scheduleMismatch && (
                      <span className="inline-flex rounded-full bg-orange-50 border border-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-600">{t("scheduleMismatchLabel")}</span>
                    )}
                    {c.editHistory && c.editHistory.length > 0 && (
                      <span className="inline-flex rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-600">{t("editedLabel")}</span>
                    )}
                    {c.acknowledgedAt && (
                      <span className="inline-flex rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-500">{t("acknowledgedLabel")}</span>
                    )}
                  </div>
                </div>
                <span className={`text-xs font-bold shrink-0 ${diff === 0 ? "text-gray-400" : diff > 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {diff === 0 ? "ตรง" : `${diff > 0 ? "+" : "-"}${formatCurrency(Math.abs(diff), country)}`}
                </span>
              </button>
            );
          })}
          {missingShifts.map(s => {
            const names = scheduleFor(ds, s.id);
            return (
              <div key={`missing-${s.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-xs font-bold text-gray-400">{s.name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{names.length > 0 ? `เวร: ${names.join(", ")}` : "ไม่ได้จัดเวร"}</p>
                </div>
                <span className="inline-flex rounded-full bg-red-50 border border-red-100 px-2 py-0.5 text-[10px] font-bold text-red-500 shrink-0">ไม่ได้ปิด</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ---------- ปฏิทิน ----------
  const firstWeekday = new Date(yy, mm - 1, 1).getDay();
  const calendarCells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];

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

      <div className="max-w-3xl mx-auto px-4 pt-6 flex flex-col gap-4">
        {/* เลือกเดือน + สลับมุมมอง */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
            <button onClick={() => changeMonth(-1)} className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 font-bold">‹</button>
            <span className="text-sm font-bold text-gray-800 px-2 min-w-[130px] text-center">{THAI_MONTHS[mm - 1]} {yy + 543}</span>
            <button onClick={() => changeMonth(1)} disabled={month >= currentMonthStr()}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 font-bold disabled:opacity-30">›</button>
          </div>
          <div className="flex bg-white border border-gray-200 rounded-xl p-1 text-xs font-bold">
            <button onClick={() => setView("days")}
              className={`px-3 py-1.5 rounded-lg transition-all ${view === "days" ? "bg-black text-white" : "text-gray-400"}`}>รายวัน</button>
            <button onClick={() => setView("calendar")}
              className={`px-3 py-1.5 rounded-lg transition-all ${view === "calendar" ? "bg-black text-white" : "text-gray-400"}`}>ปฏิทิน</button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">กำลังโหลด...</div>
        ) : view === "calendar" ? (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400 mb-2">
                {WEEKDAYS.map(w => <span key={w}>{w}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((ds, i) => {
                  if (!ds) return <div key={`pad-${i}`} />;
                  const st = dayStatus(ds);
                  const isSelected = selectedDay === ds;
                  return (
                    <button key={ds} onClick={() => setSelectedDay(isSelected ? null : ds)}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-all border ${
                        isSelected ? "border-black bg-gray-900 text-white" : "border-transparent hover:bg-gray-50 text-gray-700"
                      }`}>
                      {Number(ds.slice(-2))}
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[st]}`} />
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-50 text-[10px] text-gray-400 font-semibold">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> ปิดร้านแล้ว</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> ปิดบางกะ</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> ไม่ได้ปิด</span>
              </div>
            </div>
            {selectedDay && renderDayCard(selectedDay)}
          </>
        ) : cardDays.length === 0 ? (
          <div className="text-center py-16 text-sm text-gray-400">{t("noCashClosingHistory")}</div>
        ) : (
          <>
            {closings.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-sm font-bold text-gray-800 mb-3">{t("shiftPerformanceTitle")}</p>
                <div className="flex flex-col gap-2">
                  {summarizeByShift(closings).map(s => (
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
            )}
            <div className="flex flex-col gap-3">
              {cardDays.map(ds => renderDayCard(ds))}
            </div>
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editRow && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setEditRow(null); }}>
          <form onSubmit={submitEdit} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <p className="font-bold text-gray-900 text-lg">แก้ไขรายการปิดยอด</p>
              <button type="button" onClick={() => setEditRow(null)} className="text-gray-400 hover:text-black text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">✕</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">{editRow.businessDate.slice(0, 10)} · {editRow.shiftName ?? "-"}{editRow.isDayClose ? " · ปิดร้าน" : ""}</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">ยอดที่นับได้ (แก้ไข)</label>
                <input type="number" inputMode="decimal" min="0" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-lg font-semibold text-center outline-none focus:border-black focus:bg-white transition-all" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">วันทำการของยอดนี้ (ย้ายได้ถ้าปิดผิดวัน)</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all" />
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
              <button type="button" onClick={deleteClosing} disabled={saving}
                className="rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-all disabled:opacity-40">
                ลบ
              </button>
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
