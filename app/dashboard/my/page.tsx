"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { DEFAULT_COUNTRY_CODE } from "@/lib/countries";

interface ScheduleItem {
  id: number; workDate: string; shiftName: string; startTime: string;
  endTime: string | null; color: string | null; duty: string | null; checkedInAt: string | null;
}
interface Payslip {
  id: number; periodName: string; status: string; startDate: string; endDate: string;
  payType: "monthly" | "hourly"; hours: string; monthlyAmount: string;
  hourlyRate: string; basePay: string; tipAmount: string;
}

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function MyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE);
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [tab, setTab] = useState<"schedule" | "pay">("schedule");
  const [openSlip, setOpenSlip] = useState<Payslip | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    async function init() {
      const me = await fetch("/api/auth/me").then(r => r.ok ? r.json() : null);
      const sid = me?.user?.storeId ?? searchParams.get("storeId");
      if (sid) {
        const s = await fetch(`/api/stores/${sid}`).then(r => r.ok ? r.json() : null);
        if (s?.country) setCountry(s.country);
      }
      const res = await fetch("/api/my");
      if (res.ok) {
        const data = await res.json();
        setName(data.name); setSchedule(data.schedule); setPayslips(data.payslips);
      }
      setMounted(true);
    }
    init();
  }, [searchParams]);

  if (!mounted) return null;

  const fmtDate = (ds: string) => {
    const d = new Date(`${ds}T00:00:00`);
    return `${WEEKDAYS[d.getDay()]}. ${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-16">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/dashboard/movement")}
              className="w-9 h-9 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7" /></svg>
            </button>
            <p className="text-base font-semibold text-gray-900">ของฉัน{name ? ` · ${name}` : ""}</p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 flex gap-1 pb-2">
          <button onClick={() => setTab("schedule")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${tab === "schedule" ? "bg-black text-white" : "text-gray-400"}`}>ตารางงาน</button>
          <button onClick={() => setTab("pay")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${tab === "pay" ? "bg-black text-white" : "text-gray-400"}`}>เงินเดือน & ทิป</button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-3">
        {tab === "schedule" ? (
          schedule.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">ยังไม่มีเวรที่จัดให้</div>
          ) : schedule.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color || "#9ca3af" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">{fmtDate(s.workDate)}</p>
                <p className="text-[11px] text-gray-400">
                  {s.shiftName} · {s.startTime}{s.endTime ? `–${s.endTime}` : ""}{s.duty ? ` · ${s.duty}` : ""}
                </p>
              </div>
              {s.checkedInAt
                ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100">มาแล้ว</span>
                : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-100">รอเข้างาน</span>}
            </div>
          ))
        ) : (
          payslips.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">ยังไม่มีสลิปเงินเดือน</div>
          ) : payslips.map(p => (
            <button key={p.id} onClick={() => setOpenSlip(p)}
              className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between text-left hover:border-gray-300 transition-all">
              <div>
                <p className="text-sm font-bold text-gray-800">{p.periodName}</p>
                <p className="text-[11px] text-gray-400">{p.startDate} – {p.endDate} · {p.payType === "hourly" ? `${Number(p.hours)} ชม.` : "รายเดือน"}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">{formatCurrency(Number(p.basePay) + Number(p.tipAmount), country)}</p>
                <p className="text-[11px] text-emerald-600">ทิป {formatCurrency(Number(p.tipAmount), country)}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Payslip detail */}
      {openSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) setOpenSlip(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
              <p className="text-base font-bold text-gray-900">สลิปเงินเดือน</p>
              <p className="text-xs text-gray-500 mt-1">{name} · {openSlip.periodName}</p>
              <p className="text-[11px] text-gray-400">{openSlip.startDate} – {openSlip.endDate}</p>
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">ประเภท</span><span className="font-semibold">{openSlip.payType === "hourly" ? "รายชั่วโมง" : "รายเดือน"}</span></div>
              {openSlip.payType === "hourly" && (
                <>
                  <div className="flex justify-between"><span className="text-gray-500">ชั่วโมงทำงาน</span><span className="font-semibold">{Number(openSlip.hours)} ชม.</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">เรตต่อชั่วโมง</span><span className="font-semibold">{formatCurrency(Number(openSlip.hourlyRate), country)}</span></div>
                </>
              )}
              <div className="flex justify-between"><span className="text-gray-500">เงินเดือน</span><span className="font-semibold">{formatCurrency(Number(openSlip.basePay), country)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">ทิป</span><span className="font-semibold text-emerald-600">{formatCurrency(Number(openSlip.tipAmount), country)}</span></div>
              <div className="border-t border-dashed border-gray-300 mt-2 pt-2 flex justify-between text-base">
                <span className="font-bold text-gray-900">รวมสุทธิ</span>
                <span className="font-black text-gray-900">{formatCurrency(Number(openSlip.basePay) + Number(openSlip.tipAmount), country)}</span>
              </div>
            </div>
            <button onClick={() => setOpenSlip(null)} className="w-full mt-5 rounded-xl bg-black text-white py-2.5 text-sm font-bold hover:bg-gray-800">ปิด</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">กำลังโหลด...</div>}>
      <MyContent />
    </Suspense>
  );
}
