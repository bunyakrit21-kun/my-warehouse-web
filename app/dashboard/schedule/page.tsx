"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface Shift {
  id: number;
  name: string;
  start_time: string;
  end_time: string | null;
  color: string;
  sort_order: number;
}

interface Entry {
  id: number;
  work_date: string;
  shift_id: number;
  user_id: number;
  user_name: string;
  checked_in_at: string | null;
}

interface Employee {
  id: number;
  name: string;
  pin: string;
}

const SHIFT_COLORS: Record<string, { bg: string; text: string; border: string; chip: string }> = {
  blue:   { bg: "bg-blue-50",   text: "text-blue-800",   border: "border-blue-200",   chip: "bg-blue-100 text-blue-800" },
  green:  { bg: "bg-green-50",  text: "text-green-800",  border: "border-green-200",  chip: "bg-green-100 text-green-800" },
  orange: { bg: "bg-orange-50", text: "text-orange-800", border: "border-orange-200", chip: "bg-orange-100 text-orange-800" },
  purple: { bg: "bg-purple-50", text: "text-purple-800", border: "border-purple-200", chip: "bg-purple-100 text-purple-800" },
  red:    { bg: "bg-red-50",    text: "text-red-800",    border: "border-red-200",    chip: "bg-red-100 text-red-800" },
};

const DAY_TH = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const DAY_FULL_TH = ["จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์", "อาทิตย์"];
const MONTH_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function ScheduleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);

  const [storeId, setStoreId] = useState("");
  const [view, setView] = useState<"week" | "month">("week");
  const [weekStart, setWeekStart] = useState(() => formatDate(getMondayOf(new Date())));
  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date();
    return formatDate(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // picker modal
  const [modal, setModal] = useState<{ date: string; shift: Shift } | null>(null);
  const [saving, setSaving] = useState(false);
  const [empSearch, setEmpSearch] = useState("");

  // add shift modal
  const [shiftModal, setShiftModal] = useState(false);
  const [newShiftName, setNewShiftName] = useState("");
  const [newShiftTime, setNewShiftTime] = useState("08:00");
  const [newShiftEndTime, setNewShiftEndTime] = useState("16:00");
  const [newShiftColor, setNewShiftColor] = useState("blue");

  const fetchData = useCallback(async (sid: string, ws: string, days = 7) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schedule?storeId=${sid}&weekStart=${ws}&days=${days}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setShifts(data.shifts);
      setEntries(data.entries);
      setEmployees(data.employees);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const meData = await fetch("/api/auth/me", { cache: "no-store" }).then(r => r.json());
      const user = meData?.user;
      if (!user) { router.push("/login"); return; }
      if (user.type === "staff") { router.push("/dashboard/movement"); return; }

      let sid = searchParams.get("storeId") ?? (user.storeId ? String(user.storeId) : "");
      if (!sid) {
        const stores = await fetch("/api/stores", { cache: "no-store" }).then(r => r.ok ? r.json() : []);
        sid = stores[0]?.id ? String(stores[0].id) : "";
      }
      if (!sid) { setLoading(false); return; }
      setStoreId(sid);
      fetchData(sid, weekStart);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(new Date(weekStart), i));
  const today = formatDate(new Date());

  const entriesOn = (date: string, shiftId: number) =>
    entries.filter(e => e.work_date.slice(0, 10) === date && e.shift_id === shiftId);

  const assignedIds = modal
    ? new Set(entriesOn(modal.date, modal.shift.id).map(e => e.user_id))
    : new Set<number>();

  async function toggleEmployee(emp: Employee) {
    if (!modal) return;
    setSaving(true);
    const existing = entriesOn(modal.date, modal.shift.id).find(e => e.user_id === emp.id);
    if (existing) {
      await fetch("/api/schedule", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: existing.id, storeId }),
      });
      setEntries(prev => prev.filter(e => e.id !== existing.id));
    } else {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, workDate: modal.date, shiftId: modal.shift.id, userId: emp.id }),
      });
      const data = await res.json();
      if (data.id) {
        setEntries(prev => [...prev, {
          id: data.id,
          work_date: modal.date,
          shift_id: modal.shift.id,
          user_id: emp.id,
          user_name: emp.name,
          checked_in_at: null,
        }]);
      }
    }
    setSaving(false);
  }

  async function toggleAttendance(entry: Entry, ev: React.MouseEvent) {
    ev.stopPropagation();
    const checkedIn = !entry.checked_in_at;
    await fetch("/api/schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, storeId, checkedIn }),
    });
    setEntries(prev => prev.map(e =>
      e.id === entry.id ? { ...e, checked_in_at: checkedIn ? new Date().toISOString() : null } : e
    ));
  }

  async function addShift() {
    if (!newShiftName || !newShiftTime) return;
    const res = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, name: newShiftName, startTime: newShiftTime, endTime: newShiftEndTime || null, color: newShiftColor }),
    });
    const shift = await res.json();
    setShifts(prev => [...prev, shift].sort((a, b) => a.sort_order - b.sort_order || a.start_time.localeCompare(b.start_time)));
    setShiftModal(false);
    setNewShiftName("");
    setNewShiftTime("08:00");
    setNewShiftEndTime("16:00");
    setNewShiftColor("blue");
  }

  async function deleteShift(shift: Shift) {
    if (!confirm(`ลบ "${shift.name} ${shift.start_time}" ? (จะลบตารางงานที่ผูกไว้ด้วย)`)) return;
    await fetch("/api/shifts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: shift.id, storeId }),
    });
    setShifts(prev => prev.filter(s => s.id !== shift.id));
    setEntries(prev => prev.filter(e => e.shift_id !== shift.id));
  }

  const prevWeek = () => {
    const ws = formatDate(addDays(new Date(weekStart), -7));
    setWeekStart(ws);
    if (storeId) fetchData(storeId, ws);
  };
  const nextWeek = () => {
    const ws = formatDate(addDays(new Date(weekStart), 7));
    setWeekStart(ws);
    if (storeId) fetchData(storeId, ws);
  };

  // Month view helpers
  const getMonthCalendarDays = (ms: string): Date[] => {
    const first = new Date(ms + "T12:00:00");
    const calStart = getMondayOf(new Date(first.getFullYear(), first.getMonth(), 1));
    return Array.from({ length: 42 }, (_, i) => addDays(calStart, i));
  };

  const fetchMonthData = (sid: string, ms: string) => {
    const days = getMonthCalendarDays(ms);
    const start = formatDate(days[0]);
    fetchData(sid, start, 42);
  };

  const prevMonth = () => {
    const d = new Date(monthStart + "T12:00:00");
    const ms = formatDate(new Date(d.getFullYear(), d.getMonth() - 1, 1));
    setMonthStart(ms);
    if (storeId) fetchMonthData(storeId, ms);
  };
  const nextMonth = () => {
    const d = new Date(monthStart + "T12:00:00");
    const ms = formatDate(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    setMonthStart(ms);
    if (storeId) fetchMonthData(storeId, ms);
  };

  const switchView = (v: "week" | "month") => {
    setView(v);
    if (v === "month" && storeId) fetchMonthData(storeId, monthStart);
    if (v === "week" && storeId) fetchData(storeId, weekStart);
  };

  const weekLabel = (() => {
    const s = weekDays[0];
    const e = weekDays[6];
    if (s.getMonth() === e.getMonth())
      return `${s.getDate()}–${e.getDate()} ${MONTH_TH[s.getMonth()]} ${s.getFullYear() + 543}`;
    return `${s.getDate()} ${MONTH_TH[s.getMonth()]} – ${e.getDate()} ${MONTH_TH[e.getMonth()]} ${s.getFullYear() + 543}`;
  })();

  function handlePrint() {
    window.print();
  }

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(empSearch.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-400">
      กำลังโหลด...
    </div>
  );

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: fixed; inset: 0; padding: 24px; background: white; }
          #print-area table { border-collapse: collapse; width: 100%; font-size: 11px; }
          #print-area th, #print-area td { border: 1px solid #ddd; padding: 6px 8px; }
          #print-area th { background: #f5f5f5; font-weight: 700; }
        }
      `}</style>

      <main className="min-h-screen bg-gray-50 font-sans antialiased pb-16">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white sticky top-0 z-20">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 bg-gray-50 text-lg">📅</div>
              <div>
                <p className="font-bold text-gray-900 leading-tight">ตารางเข้างาน</p>
                <p className="text-xs text-gray-400">Work Schedule</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold">
                <button onClick={() => switchView("week")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${view === "week" ? "bg-white shadow text-gray-900 border border-gray-200" : "text-gray-400 hover:text-gray-700"}`}>
                  สัปดาห์
                </button>
                <button onClick={() => switchView("month")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${view === "month" ? "bg-white shadow text-gray-900 border border-gray-200" : "text-gray-400 hover:text-gray-700"}`}>
                  ปฏิทิน
                </button>
              </div>
              <button onClick={handlePrint}
                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-black transition-all flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                พิมพ์
              </button>
              <button onClick={() => setShiftModal(true)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-black transition-all">
                + ตารางงาน
              </button>
              <Link href="/dashboard" className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold hover:border-black transition-all">
                กลับ
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-6">
          {/* Navigator */}
          {view === "week" ? (
            <div className="flex items-center justify-between mb-6">
              <button onClick={prevWeek} className="rounded-xl border border-gray-200 bg-white w-9 h-9 flex items-center justify-center hover:border-black transition-all text-gray-600 font-bold">‹</button>
              <div className="text-center">
                <p className="font-bold text-gray-900 text-lg">{weekLabel}</p>
                <button onClick={() => { const ws = formatDate(getMondayOf(new Date())); setWeekStart(ws); if (storeId) fetchData(storeId, ws); }}
                  className="text-xs text-gray-400 hover:text-black transition-colors">
                  สัปดาห์นี้
                </button>
              </div>
              <button onClick={nextWeek} className="rounded-xl border border-gray-200 bg-white w-9 h-9 flex items-center justify-center hover:border-black transition-all text-gray-600 font-bold">›</button>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-6">
              <button onClick={prevMonth} className="rounded-xl border border-gray-200 bg-white w-9 h-9 flex items-center justify-center hover:border-black transition-all text-gray-600 font-bold">‹</button>
              <div className="text-center">
                <p className="font-bold text-gray-900 text-lg">
                  {MONTH_TH[new Date(monthStart + "T12:00:00").getMonth()]} {new Date(monthStart + "T12:00:00").getFullYear() + 543}
                </p>
                <button onClick={() => { const ms = formatDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setMonthStart(ms); if (storeId) fetchMonthData(storeId, ms); }}
                  className="text-xs text-gray-400 hover:text-black transition-colors">
                  เดือนนี้
                </button>
              </div>
              <button onClick={nextMonth} className="rounded-xl border border-gray-200 bg-white w-9 h-9 flex items-center justify-center hover:border-black transition-all text-gray-600 font-bold">›</button>
            </div>
          )}

          {/* Attendance legend */}
          {shifts.length > 0 && (
            <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-green-400" /> มาทำงาน (คลิกชิปเพื่อเช็คชื่อ)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-gray-300" /> ยังไม่เช็ค
              </span>
            </div>
          )}

          {/* Month Calendar View */}
          {view === "month" && (
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-gray-100">
                {DAY_TH.map((d, i) => (
                  <div key={i} className="py-2 text-center text-xs font-bold text-gray-400">{d}</div>
                ))}
              </div>
              {/* Calendar days */}
              <div className="grid grid-cols-7">
                {getMonthCalendarDays(monthStart).map((d, i) => {
                  const dateStr = formatDate(d);
                  const isThisMonth = d.getMonth() === new Date(monthStart + "T12:00:00").getMonth();
                  const isToday = dateStr === today;
                  const dayEntries = entries.filter(e => e.work_date.slice(0, 10) === dateStr);
                  const uniqueEmps = Array.from(new Set(dayEntries.map(e => e.user_name)));
                  return (
                    <div
                      key={i}
                      onClick={() => {
                        const ws = formatDate(getMondayOf(d));
                        setWeekStart(ws);
                        setView("week");
                        if (storeId) fetchData(storeId, ws);
                      }}
                      className={`min-h-[90px] p-2 border-b border-r border-gray-100 cursor-pointer hover:bg-gray-50 transition-all
                        ${!isThisMonth ? "bg-gray-50/50" : ""}
                        ${i % 7 === 6 ? "border-r-0" : ""}
                        ${i >= 35 ? "border-b-0" : ""}
                      `}
                    >
                      <div className={`text-xs font-black mb-1.5 w-6 h-6 flex items-center justify-center rounded-full
                        ${isToday ? "bg-black text-white" : isThisMonth ? "text-gray-900" : "text-gray-300"}`}>
                        {d.getDate()}
                      </div>
                      {/* Employee chips mini */}
                      <div className="space-y-0.5">
                        {uniqueEmps.slice(0, 3).map((name, ni) => (
                          <div key={ni} className="text-[9px] font-semibold bg-blue-100 text-blue-700 rounded px-1 py-0.5 truncate leading-tight">
                            {name}
                          </div>
                        ))}
                        {uniqueEmps.length > 3 && (
                          <div className="text-[9px] text-gray-400 font-semibold">+{uniqueEmps.length - 3} คน</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 text-center py-2 border-t border-gray-100">คลิกวันเพื่อดูรายละเอียดสัปดาห์</p>
            </div>
          )}

          {view === "week" && (shifts.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-semibold text-gray-700 mb-1">ยังไม่มีตารางงาน</p>
              <p className="text-sm text-gray-400 mb-5">เพิ่มตารางงานก่อน เช่น กะเช้า 08:00, กะบ่าย 16:00</p>
              <button onClick={() => setShiftModal(true)}
                className="bg-black text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-all">
                + เพิ่มตารางแรก
              </button>
            </div>
          ) : (
            <>
              {/* Schedule Grid */}
              <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm" ref={printRef}>
                <div id="print-area">
                  <p className="hidden print:block text-lg font-bold px-4 pt-4 pb-2">ตารางเข้างาน — {weekLabel}</p>
                  <table className="w-full border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="w-32 px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/50">ตารางเข้างาน</th>
                        {weekDays.map((d, i) => {
                          const dateStr = formatDate(d);
                          const isToday = dateStr === today;
                          return (
                            <th key={i} className={`px-3 py-3 text-center min-w-[110px] ${isToday ? "bg-black/5" : ""}`}>
                              <p className={`text-xs font-semibold ${isToday ? "text-black" : "text-gray-400"}`}>{DAY_TH[i]}</p>
                              <p className={`text-xl font-black leading-tight ${isToday ? "text-black" : "text-gray-700"}`}>{d.getDate()}</p>
                              {isToday && <div className="w-1.5 h-1.5 bg-black rounded-full mx-auto mt-0.5 print:hidden" />}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {shifts.map((shift, si) => {
                        const c = SHIFT_COLORS[shift.color] ?? SHIFT_COLORS.blue;
                        return (
                          <tr key={shift.id} className={`border-b border-gray-100 last:border-0 ${si % 2 === 0 ? "" : "bg-gray-50/30"}`}>
                            <td className="px-4 py-3 align-top">
                              <div className="flex items-start justify-between gap-1">
                                <div>
                                  <p className={`text-xs font-bold ${c.text}`}>{shift.name}</p>
                                  <p className="text-sm font-black text-gray-800">{shift.start_time}</p>
                                </div>
                                <button onClick={() => deleteShift(shift)} className="text-gray-200 hover:text-red-400 transition-colors text-xs mt-0.5 flex-shrink-0 print:hidden">✕</button>
                              </div>
                            </td>
                            {weekDays.map((d, di) => {
                              const dateStr = formatDate(d);
                              const cellEntries = entriesOn(dateStr, shift.id);
                              const isToday = dateStr === today;
                              return (
                                <td key={di} className={`px-2 py-2 align-top ${isToday ? "bg-black/5" : ""}`}>
                                  <div
                                    className="min-h-[60px] rounded-xl p-1.5 cursor-pointer group relative"
                                    onClick={() => setModal({ date: dateStr, shift })}
                                  >
                                    {/* Employee chips */}
                                    <div className="flex flex-wrap gap-1 mb-1">
                                      {cellEntries.map(e => (
                                        <button
                                          key={e.id}
                                          title={e.checked_in_at ? "มาทำงานแล้ว — คลิกเพื่อยกเลิก" : "คลิกเพื่อเช็คชื่อเข้างาน"}
                                          onClick={(ev) => toggleAttendance(e, ev)}
                                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg transition-all border
                                            ${e.checked_in_at
                                              ? "bg-green-100 text-green-800 border-green-300"
                                              : `${c.chip} border-transparent`}
                                          `}
                                        >
                                          {e.checked_in_at ? "✓ " : ""}{e.user_name}
                                        </button>
                                      ))}
                                    </div>
                                    {/* Add more / empty */}
                                    <div className={`text-gray-300 text-xs font-medium text-center transition-all print:hidden
                                      ${cellEntries.length === 0 ? "pt-3" : "opacity-0 group-hover:opacity-100"}`}>
                                      +
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">คลิกช่องเพื่อเพิ่ม/ลบพนักงาน • คลิกชิปชื่อเพื่อเช็คเข้างาน</p>
            </>
          ))}
        </div>
      </main>

      {/* Employee Picker Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setModal(null); setEmpSearch(""); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal header */}
            <div className={`px-5 py-4 flex-shrink-0 ${SHIFT_COLORS[modal.shift.color]?.bg ?? "bg-gray-50"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500">
                    {DAY_FULL_TH[new Date(modal.date + "T12:00:00").getDay() === 0 ? 6 : new Date(modal.date + "T12:00:00").getDay() - 1]}{" "}
                    {new Date(modal.date + "T12:00:00").getDate()}{" "}
                    {MONTH_TH[new Date(modal.date + "T12:00:00").getMonth()]}
                  </p>
                  <p className="font-black text-gray-900 text-lg">{modal.shift.start_time} — {modal.shift.name}</p>
                </div>
                <button onClick={() => { setModal(null); setEmpSearch(""); }}
                  className="text-gray-400 hover:text-black text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all">✕</button>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 pt-4 pb-2 flex-shrink-0">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="ค้นหาพนักงาน..."
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-black focus:bg-white transition-all"
                />
              </div>
              <p className="text-xs text-gray-400 mt-2 px-0.5">เลือกพนักงานที่จะเข้ากะนี้</p>
            </div>

            {/* Employee list — scrollable */}
            <div className="overflow-y-auto flex-1 px-4 pb-4">
              {employees.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">ยังไม่มีพนักงานในร้านนี้</p>
              ) : filteredEmployees.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">ไม่พบพนักงาน &ldquo;{empSearch}&rdquo;</p>
              ) : (
                <div className="space-y-1.5">
                  {filteredEmployees.map(emp => {
                    const selected = assignedIds.has(emp.id);
                    return (
                      <button
                        key={emp.id}
                        onClick={() => toggleEmployee(emp)}
                        disabled={saving}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all
                          ${selected
                            ? "border-black bg-black text-white"
                            : "border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-white"
                          } disabled:opacity-60`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0
                            ${selected ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"}`}>
                            {emp.name[0]}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-semibold leading-tight">{emp.name}</p>
                            <p className={`text-xs ${selected ? "text-white/60" : "text-gray-400"}`}>PIN: {emp.pin}</p>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs flex-shrink-0 transition-all
                          ${selected ? "border-white bg-white text-black" : "border-gray-300"}`}>
                          {selected && "✓"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Shift Modal */}
      {shiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShiftModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="font-bold text-gray-900 text-lg">เพิ่มตารางงาน</p>
              <button onClick={() => setShiftModal(false)} className="text-gray-400 hover:text-black text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">ชื่อตาราง</label>
                <input value={newShiftName} onChange={e => setNewShiftName(e.target.value)}
                  placeholder="เช่น กะเช้า, กะบ่าย, กะดึก"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">เวลาเริ่ม</label>
                  <input type="time" value={newShiftTime} onChange={e => setNewShiftTime(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">เวลาเลิก</label>
                  <input type="time" value={newShiftEndTime} onChange={e => setNewShiftEndTime(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-2">สี</label>
                <div className="flex gap-2">
                  {Object.entries(SHIFT_COLORS).map(([key, val]) => (
                    <button key={key} onClick={() => setNewShiftColor(key)}
                      className={`w-8 h-8 rounded-lg ${val.chip} border-2 transition-all ${newShiftColor === key ? "border-black scale-110" : "border-transparent"}`} />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setShiftModal(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:border-gray-400 transition-all">
                ยกเลิก
              </button>
              <button onClick={addShift} disabled={!newShiftName || !newShiftTime}
                className="flex-1 rounded-xl bg-black py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-all disabled:bg-gray-200 disabled:text-gray-400">
                เพิ่มตาราง
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-400">
        กำลังโหลด...
      </div>
    }>
      <ScheduleContent />
    </Suspense>
  );
}
