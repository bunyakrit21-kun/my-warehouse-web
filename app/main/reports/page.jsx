"use client";

import { useState } from "react";
import Link from "next/link";

// ข้อมูลจำลองสถิติภาพรวม
const MOCK_SUMMARY = {
  totalMovementToday: 23,
  totalItems: 7,
  lowStockCount: 3,
  stockInVolume: 300,
  stockOutVolume: 52,
};

// ข้อมูลจำลองสินค้าที่มีการเคลื่อนไหวสูงสุด (Top Moving Items) สำหรับทำกราฟแท่ง
const TOP_MOVING_ITEMS = [
  { name: "วัตถุดิบ A (เกรดพรีเมียม)", type: "รับเข้า", volume: 150, unit: "กก.", percentage: "100%", color: "bg-black" },
  { name: "แก้วกาแฟ DiaM 16oz", type: "รับเข้า", volume: 120, unit: "ชิ้น", percentage: "80%", color: "bg-gray-600" },
  { name: "กล่องบรรจุภัณฑ์ ขนาด M", type: "เบิกออก", volume: 50, unit: "ชิ้น", percentage: "35%", color: "bg-gray-400" },
  { name: "ซอสปรุงรสสูตรเข้มข้น", type: "เบิกออก", volume: 15, unit: "แกลลอน", percentage: "10%", color: "bg-gray-300" },
];

// ข้อมูลสรุปยอดแยกตามหมวดหมู่
const CATEGORY_REPORT = [
  { category: "วัตถุดิบหลัก", itemsCount: 2, stockIn: 150, stockOut: 0, status: "ปกติ" },
  { category: "เครื่องปรุง", itemsCount: 3, stockIn: 11, stockOut: 2, status: "ใกล้หมด ⚠️" },
  { category: "แพ็คเกจจิ้ง", itemsCount: 2, stockIn: 200, stockOut: 50, status: "ปกติ" },
];

export default function ReportsPage() {
  const [timeFrame, setTimeFrame] = useState("today"); // today, week, month

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Top bar (ไอคอนตรงตามหน้าหลักของคุณ) */}
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-gray-300 bg-gray-50">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 text-gray-700"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19V5" />
                <path d="M8 19V9" />
                <path d="M12 19V12" />
                <path d="M16 19V7" />
                <path d="M20 19V10" />
              </svg>
            </div>
            <div className="leading-tight">
              <p className="text-lg font-semibold tracking-tight">DiaM</p>
              <p className="text-xs text-gray-500">Smart Inventory System</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/main"
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              กลับหน้าเริ่มต้น
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">รายงาน / สรุปภาพรวม</h1>
            <p className="mt-1 text-sm text-gray-600">วิเคราะห์ข้อมูลสต็อกสินค้า อัตราการเข้าออก และสินค้าคงคลัง</p>
          </div>
          
          {/* ตัวเลือกช่วงเวลา */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl self-start sm:self-center">
            <button
              onClick={() => setTimeFrame("today")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                timeFrame === "today" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"
              }`}
            >
              วันนี้
            </button>
            <button
              onClick={() => setTimeFrame("week")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                timeFrame === "week" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"
              }`}
            >
              สัปดาห์นี้
            </button>
            <button
              onClick={() => setTimeFrame("month")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                timeFrame === "month" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"
              }`}
            >
              เดือนนี้
            </button>
          </div>
        </div>

        {/* 1. Quick Stats Cards Grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-gray-500">ความเคลื่อนไหวรวม ({timeFrame === "today" ? "วันนี้" : timeFrame === "week" ? "สัปดาห์นี้" : "เดือนนี้"})</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{MOCK_SUMMARY.totalMovementToday} รายการ</p>
            <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
              <span>📈</span> ทำรายการเสร็จสมบูรณ์ 100%
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-gray-500">ปริมาณรับเข้า (Stock In)</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">+{MOCK_SUMMARY.stockInVolume}</p>
            <div className="mt-2 text-xs text-gray-500">
              หน่วยนับสะสมตามวัตถุดิบ
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-gray-500">ปริมาณเบิกออก (Stock Out)</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">-{MOCK_SUMMARY.stockOutVolume}</p>
            <div className="mt-2 text-xs text-gray-500">
              นำไปใช้ผลิต / บรรจุสินค้า
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-gray-500">สินค้าต้องเฝ้าระวัง</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-amber-600">{MOCK_SUMMARY.lowStockCount} ชนิด</p>
            <div className="mt-2 text-xs text-amber-700 font-medium">
              ⚠️ ใกล้หมดคลัง / ควรเติมของ
            </div>
          </div>
        </div>

        {/* 2. Charts and Analytical Section */}
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          
          {/* กราฟจำลอง: สินค้าเคลื่อนไหวสูงสุด (2 ส่วนของกริต) */}
          <div className="md:col-span-2 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">สินค้าเคลื่อนไหวสูงสุด (Top Moving)</h3>
                <p className="text-xs text-gray-500">จัดอันดับตามปริมาณความถี่ในการ รับเข้า-เบิกออก</p>
              </div>
              <span className="text-xs font-mono bg-gray-50 border border-gray-200 px-2 py-1 rounded-md text-gray-500">
                สถิติเรียลไทม์
              </span>
            </div>

            {/* Custom Tailwind CSS Bar Charts */}
            <div className="space-y-5">
              {TOP_MOVING_ITEMS.map((item, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-gray-900">{item.name}</span>
                    <span className="text-gray-500 font-mono">
                      {item.type}: <strong className="text-gray-900">{item.volume}</strong> {item.unit}
                    </span>
                  </div>
                  {/* แถบกราฟแท่ง */}
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                      style={{ width: item.percentage }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* การ์ดขวา: ปุ่มเครื่องมือออกรายงานรวดเร็ว */}
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">เครื่องมือออกรายงาน</h3>
              <p className="text-xs text-gray-500 mt-1">ส่งออกข้อมูลคลังสินค้าเพื่อนำไปใช้คำนวณบัญชีหรือคุยกับซัพพลายเออร์</p>
              
              <div className="mt-5 space-y-2">
                <button type="button" className="w-full text-left rounded-xl border border-gray-200 bg-white p-3 text-xs font-medium hover:border-gray-400 transition flex items-center justify-between">
                  <span>📄 รายงานสต็อกคงเหลือปัจจุบัน</span>
                  <span className="text-gray-400">.PDF</span>
                </button>
                <button type="button" className="w-full text-left rounded-xl border border-gray-200 bg-white p-3 text-xs font-medium hover:border-gray-400 transition flex items-center justify-between">
                  <span>📊 ประวัติการเดินบัญชีสินค้า (Log)</span>
                  <span className="text-gray-400">.CSV</span>
                </button>
                <button type="button" className="w-full text-left rounded-xl border border-gray-200 bg-white p-3 text-xs font-medium hover:border-gray-400 transition flex items-center justify-between">
                  <span>⚠️ รายการสินค้าที่ต้องสั่งซื้อเพิ่ม</span>
                  <span className="text-red-500 font-bold">!</span>
                </button>
              </div>
            </div>
            
            <div className="mt-6 border-t border-gray-200 pt-4 text-xs text-gray-400">
              * ข้อมูลอัปเดตอัตโนมัติจากหน้าบันทึกการเคลื่อนไหว
            </div>
          </div>
        </div>

        {/* 3. ตารางรายงานแยกตามหมวดหมู่วัตถุดิบ */}
        <div className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">สรุปรายงานแยกตามหมวดหมู่</h2>
            <p className="text-sm text-gray-600">วิเคราะห์ข้อมูลภาพรวมเจาะลึกในแต่ละกลุ่มสินค้า</p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-4">ชื่อหมวดหมู่สินค้า</th>
                    <th className="px-6 py-4 text-center">จำนวนชนิดสินค้า</th>
                    <th className="px-6 py-4 text-center">รับเข้ารวม</th>
                    <th className="px-6 py-4 text-center">เบิกออกรวม</th>
                    <th className="px-6 py-4">สถานะภายในหมวดหมู่</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {CATEGORY_REPORT.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {row.category}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-600">
                        {row.itemsCount} รายการ
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-green-600">
                        +{row.stockIn}
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-red-500">
                        -{row.stockOut}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          row.status.includes("⚠️") ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <p className="mt-8 text-xs text-gray-400 text-center">* หน้าสรุปรายงานเวอร์ชันเดโม ปรับขนาดตามหน้าจออัตโนมัติ</p>
      </section>
    </main>
  );
}