"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface Shift {
  id: number;
  name: string;
  start_time: string;
  color: string;
  sort_order: number;
}

interface Entry {
  id: number;
  work_date: string;
  shift_id: number;
  user_id: number;
  user_name: string;
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

export default function SchedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [storeId, setStoreId] = useState("");
  const [weekStart, setWeekStart] = useState(() => formatDate(getMondayOf(new Date())));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // modal state
  const [modal, setModal] = useState<{ date: string; shift: Shift } | null>(null);
  const [saving, setSaving] = useState(false);

  // add shift modal
  const [shiftModal, setShiftModal] = useState(false);
  const [newShiftName, setNewShiftName] = useState("");
  const [newShiftTime, setNewShiftTime] = useState("08:00");
  const [newShiftColor, setNewShiftColor] = useState("blue");

  const fetchData = useCallback(async (sid: string, ws: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schedule?storeId=${sid}&weekStart=${ws}`, { cache: "no-store" });
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

      // staff มี storeId ใน token, admin ต้องดึงจาก URL หรือ API
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
  }, []);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(new Date(weekStart), i));

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
        }]);
      }
    }
    setSaving(false);
  }

  async function addShift() {
    if (!newShiftName || !newShiftTime) return;
    const res = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, name: newShiftName, startTime: newShiftTime, color: newShiftColor }),
    });
    const shift = await res.json();
    setShifts(prev => [...prev, shift].sort((a, b) => a.sort_order - b.sort_order || a.start_time.localeCompare(b.start_time)));
    setShiftModal(false);
    setNewShiftName("");
    setNewShiftTime("08:00");
    setNewShiftColor("blue");
  }

  async function deleteShift(shift: Shift) {
    if (!confirm(`ลบกะ "${shift.name} ${shift.start_time}" ? (จะลบตารางงานที่ผูกไว้ด้วย)`)) return;
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

  const weekLabel = (() => {
    const s = weekDays[0];
    const e = weekDays[6];
    if (s.getMonth() === e.getMonth())
      return `${s.getDate()}–${e.getDate()} ${MONTH_TH[s.getMonth()]} ${s.getFullYear() + 543}`;
    return `${s.getDate()} ${MONTH_TH[s.getMonth()]} – ${e.getDate()} ${MONTH_TH[e.getMonth()]} ${s.getFullYear() + 543}`;
  })();

  const today = formatDate(new Date());

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-400">
      กำลังโหลด...
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50 font-sans antialiased pb-16">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 bg-gray-50 text-lg">📅</div>
            <div>
              <p className="font-bold text-gray-900 leading-tight">จัดกะพนักงาน</p>
              <p className="text-xs text-gray-400">Work Schedule</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShiftModal(true)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-black transition-all">
              + เพิ่มกะ
            </button>
            <Link href="/dashboard" className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold hover:border-black transition-all">
              กลับหน้าหลัก
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Week Navigator */}
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

        {shifts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-semibold text-gray-700 mb-1">ยังไม่มีกะงาน</p>
            <p className="text-sm text-gray-400 mb-5">เพิ่มกะงานก่อน เช่น กะบ่าย 16:00, กะดึก 22:00</p>
            <button onClick={() => setShiftModal(true)}
              className="bg-black text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-all">
              + เพิ่มกะแรก
            </button>
          </div>
        ) : (
          /* Schedule Grid */
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="w-28 px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/50">กะ</th>
                  {weekDays.map((d, i) => {
                    const dateStr = formatDate(d);
                    const isToday = dateStr === today;
                    return (
                      <th key={i} className={`px-3 py-3 text-center min-w-[110px] ${isToday ? "bg-black/5" : ""}`}>
                        <p className={`text-xs font-semibold ${isToday ? "text-black" : "text-gray-400"}`}>{DAY_TH[i]}</p>
                        <p className={`text-xl font-black leading-tight ${isToday ? "text-black" : "text-gray-700"}`}>{d.getDate()}</p>
                        {isToday && <div className="w-1.5 h-1.5 bg-black rounded-full mx-auto mt-0.5" />}
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
                          <button onClick={() => deleteShift(shift)} className="text-gray-200 hover:text-red-400 transition-colors text-xs mt-0.5 flex-shrink-0">✕</button>
                        </div>
                      </td>
                      {weekDays.map((d, di) => {
                        const dateStr = formatDate(d);
                        const cellEntries = entriesOn(dateStr, shift.id);
                        const isToday = dateStr === today;
                        return (
                          <td key={di} className={`px-2 py-2 align-top ${isToday ? "bg-black/5" : ""}`}>
                            <button
                              onClick={() => setModal({ date: dateStr, shift })}
                              className={`w-full min-h-[56px] rounded-xl border-2 border-dashed p-1.5 text-left transition-all hover:border-gray-400 hover:bg-gray-50
                                ${cellEntries.length > 0 ? `${c.bg} ${c.border} border-solid` : "border-gray-200 bg-transparent"}`}
                            >
                              {cellEntries.length === 0 ? (
                                <span className="text-gray-300 text-xs font-medium block text-center pt-2">+</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {cellEntries.map(e => (
                                    <span key={e.id} className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${c.chip}`}>
                                      {e.user_name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        {shifts.length > 0 && (
          <p className="text-xs text-gray-400 mt-3 text-center">คลิกช่องเพื่อเพิ่ม/ลบพนักงาน</p>
        )}
      </div>

      {/* Employee Picker Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className={`px-5 py-4 ${SHIFT_COLORS[modal.shift.color]?.bg ?? "bg-gray-50"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500">
                    {DAY_FULL_TH[new Date(modal.date + "T12:00:00").getDay() === 0 ? 6 : new Date(modal.date + "T12:00:00").getDay() - 1]} {new Date(modal.date + "T12:00:00").getDate()} {MONTH_TH[new Date(modal.date + "T12:00:00").getMonth()]}
                  </p>
                  <p className="font-black text-gray-900 text-lg">{modal.shift.start_time} — {modal.shift.name}</p>
                </div>
                <button onClick={() => setModal(null)} className="text-gray-400 hover:text-black text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all">✕</button>
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-gray-500 mb-3">เลือกพนักงาน</p>
              {employees.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีพนักงานในร้านนี้</p>
              ) : (
                <div className="space-y-2">
                  {employees.map(emp => {
                    const selected = assignedIds.has(emp.id);
                    return (
                      <button
                        key={emp.id}
                        onClick={() => toggleEmployee(emp)}
                        disabled={saving}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all font-semibold text-sm
                          ${selected
                            ? "border-black bg-black text-white"
                            : "border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-white"
                          } disabled:opacity-60`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${selected ? "bg-white/20" : "bg-gray-200 text-gray-600"}`}>
                            {emp.name[0]}
                          </div>
                          <span>{emp.name}</span>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs transition-all
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
              <p className="font-bold text-gray-900 text-lg">เพิ่มกะงาน</p>
              <button onClick={() => setShiftModal(false)} className="text-gray-400 hover:text-black text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">ชื่อกะ</label>
                <input value={newShiftName} onChange={e => setNewShiftName(e.target.value)}
                  placeholder="เช่น กะบ่าย, กะดึก"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">เวลาเริ่ม</label>
                <input type="time" value={newShiftTime} onChange={e => setNewShiftTime(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all" />
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
                เพิ่มกะ
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
