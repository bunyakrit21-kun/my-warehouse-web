"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Summary {
  total_in: number;
  total_out: number;
  volume_in: number;
  volume_out: number;
  total_movements: number;
}

interface TopProduct {
  name: string;
  total_in: number;
  total_out: number;
  total_movements: number;
}

interface DailyTrend {
  date: string;
  volume_in: number;
  volume_out: number;
}

export default function ReportsPage() {
  const [range, setRange] = useState("today");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?range=${range}`)
      .then(r => r.json())
      .then(data => {
        setSummary(data.summary);
        setTopProducts(data.topProducts);
        setDailyTrend(data.dailyTrend);
      })
      .finally(() => setLoading(false));
  }, [range]);

  // หา max value สำหรับ scale กราฟ
  const maxTopMovement = Math.max(...topProducts.map(p => Number(p.total_movements)), 1);
  const maxDailyVolume = Math.max(...dailyTrend.flatMap(d => [Number(d.volume_in), Number(d.volume_out)]), 1);

  const RANGE_LABEL: Record<string, string> = { today: "วันนี้", week: "7 วันล่าสุด", month: "30 วันล่าสุด" };

  return (
    <main className="min-h-screen bg-gray-50 text-black font-sans antialiased pb-12">

      {/* HEADER */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-gray-300 bg-gray-50">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-gray-700" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 19V5M8 19V9M12 19V12M16 19V7M20 19V10" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">DiaM</p>
              <p className="text-xs text-gray-500">Smart Inventory System</p>
            </div>
          </div>
          <Link href="/dashboard" className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold hover:border-black transition-all">
            กลับหน้าเริ่มต้น
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">

        {/* Title + Range Selector */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">รายงานและสถิติ</h1>
            <p className="mt-1 text-sm text-gray-500">ข้อมูลจริงจากระบบคลังสินค้า — {RANGE_LABEL[range]}</p>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
            {["today", "week", "month"].map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${range === r ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"}`}>
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-sm text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : (
          <>
            {/* Quick Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">ความเคลื่อนไหวรวม</p>
                <p className="mt-2 text-3xl font-black">{summary?.total_movements ?? 0} <span className="text-xs font-normal text-gray-400">รายการ</span></p>
                <p className="mt-2 text-xs text-gray-400">รับเข้า {summary?.total_in ?? 0} / เบิกออก {summary?.total_out ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">ปริมาณรับเข้า</p>
                <p className="mt-2 text-3xl font-black text-green-600">+{summary?.volume_in ?? 0}</p>
                <p className="mt-2 text-xs text-gray-400">หน่วยรวมทุกสินค้า</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">ปริมาณเบิกออก</p>
                <p className="mt-2 text-3xl font-black text-red-500">-{summary?.volume_out ?? 0}</p>
                <p className="mt-2 text-xs text-gray-400">หน่วยรวมทุกสินค้า</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">สุทธิ (Net)</p>
                <p className={`mt-2 text-3xl font-black ${(summary?.volume_in ?? 0) - (summary?.volume_out ?? 0) >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {(summary?.volume_in ?? 0) - (summary?.volume_out ?? 0) >= 0 ? "+" : ""}
                  {(summary?.volume_in ?? 0) - (summary?.volume_out ?? 0)}
                </p>
                <p className="mt-2 text-xs text-gray-400">ผลต่างรับเข้า - เบิกออก</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mb-6">

              {/* กราฟแท่ง: Top 5 สินค้าที่เคลื่อนไหวบ่อย */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-base font-bold text-gray-800 mb-1">Top สินค้าที่เคลื่อนไหวบ่อย</h3>
                <p className="text-xs text-gray-400 mb-5">จัดอันดับตามจำนวนครั้งที่ทำรายการ</p>
                {topProducts.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">ยังไม่มีข้อมูลในช่วงเวลานี้</p>
                ) : (
                  <div className="space-y-4">
                    {topProducts.map((p, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-semibold text-gray-800 truncate max-w-[200px]">{p.name}</span>
                          <span className="text-gray-500 font-mono shrink-0 ml-2">{p.total_movements} ครั้ง</span>
                        </div>
                        <div className="flex gap-1 h-2.5 rounded-full overflow-hidden bg-gray-100">
                          <div className="bg-green-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${(Number(p.total_in) / (Number(p.total_in) + Number(p.total_out) || 1)) * (Number(p.total_movements) / maxTopMovement) * 100}%` }} />
                          <div className="bg-red-400 h-full rounded-full transition-all duration-500"
                            style={{ width: `${(Number(p.total_out) / (Number(p.total_in) + Number(p.total_out) || 1)) * (Number(p.total_movements) / maxTopMovement) * 100}%` }} />
                        </div>
                        <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                          <span className="text-green-600 font-bold">+{p.total_in ?? 0} รับเข้า</span>
                          <span className="text-red-500 font-bold">-{p.total_out ?? 0} เบิกออก</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex items-center gap-3 text-[10px] text-gray-400 border-t border-gray-100 pt-3">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>รับเข้า</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>เบิกออก</span>
                </div>
              </div>

              {/* กราฟแท่ง: Trend รายวัน 7 วัน */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-base font-bold text-gray-800 mb-1">Trend รายวัน 7 วันล่าสุด</h3>
                <p className="text-xs text-gray-400 mb-5">ปริมาณรับเข้า vs เบิกออกแต่ละวัน</p>
                {dailyTrend.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">ยังไม่มีข้อมูลในช่วงเวลานี้</p>
                ) : (
                  <div className="flex items-end gap-2 h-32">
                    {dailyTrend.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex gap-0.5 items-end" style={{ height: "96px" }}>
                          <div className="flex-1 bg-green-500 rounded-t-md transition-all duration-500 min-h-[2px]"
                            style={{ height: `${(Number(d.volume_in) / maxDailyVolume) * 96}px` }} />
                          <div className="flex-1 bg-red-400 rounded-t-md transition-all duration-500 min-h-[2px]"
                            style={{ height: `${(Number(d.volume_out) / maxDailyVolume) * 96}px` }} />
                        </div>
                        <span className="text-[9px] text-gray-400 font-mono">
                          {new Date(d.date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex items-center gap-3 text-[10px] text-gray-400 border-t border-gray-100 pt-3">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>รับเข้า</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>เบิกออก</span>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}