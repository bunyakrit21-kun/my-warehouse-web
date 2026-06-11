"use client";

import { useState } from "react";
import Link from "next/link";

// ข้อมูลประวัติการเคลื่อนไหวจำลอง (ให้สอดคล้องกับตัวเลข Movement วันนี้: 23 ในหน้าแรก)
const INITIAL_MOVEMENTS = [
  { id: "MV-0023", time: "15:24 น.", type: "MOVE_OUT", itemName: "ซอสปรุงรสสูตรเข้มข้น", qty: 2, unit: "แกลลอน", note: "เบิกไปใช้ที่ครัวร้อน", user: "DiaM Admin" },
  { id: "MV-0022", time: "14:15 น.", type: "MOVE_IN", itemName: "วัตถุดิบ A (เกรดพรีเมียม)", qty: 100, unit: "กิโลกรัม", note: "ล็อตนำเข้าประจำสัปดาห์", user: "DiaM Admin" },
  { id: "MV-0021", time: "11:30 น.", type: "MOVE_OUT", itemName: "กล่องบรรจุภัณฑ์ ขนาด M", qty: 50, unit: "ชิ้น", status: "normal", note: "แพ็คของส่งออเดอร์เที่ยบ", user: "Qiu Yue" },
  { id: "MV-0020", time: "09:00 น.", type: "MOVE_IN", itemName: "แก้วกาแฟ DiaM 16oz", qty: 200, unit: "ชิ้น", note: "ของเติมเข้าคลังหลัก", user: "Li Dong" },
];

export default function MovementPage() {
  const [movements, setMovements] = useState(INITIAL_MOVEMENTS);
  const [type, setType] = useState("MOVE_IN"); // MOVE_IN หรือ MOVE_OUT
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("ชิ้น");
  const [note, setNote] = useState("");

  // ฟังก์ชันรองรับการกดบันทึกข้อมูล (Client-side Demo)
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!itemName || !qty) return alert("กรุณากรอกชื่อสินค้าและจำนวน");

    const newMovement = {
      id: `MV-${String(movements.length + 21).padStart(4, "0")}`,
      time: "เมื่อสักครู่",
      type: type,
      itemName: itemName,
      qty: parseFloat(qty),
      unit: unit,
      note: note || "-",
      user: "DiaM Admin",
    };

    setMovements([newMovement, ...movements]);
    
    // รีเซ็ตค่าฟอร์มหลังบันทึก
    setItemName("");
    setQty("");
    setNote("");
  };

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Top bar */}
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
                <path d="M7 7h10" />
                <path d="M7 12h10" />
                <path d="M7 17h6" />
                <path d="M4 4h16v16H4z" />
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
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">รับเข้า / เบิกออกสินค้า</h1>
          <p className="mt-1 text-sm text-gray-600">บันทึกประวัติการนำสินค้าเข้าคลัง หรือเบิกสินค้าออกไปใช้งาน</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* ฝั่งซ้าย: ฟอร์มบันทึกข้อมูล (2 ส่วน) */}
          <div className="md:col-span-2 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">ทำรายการบันทึกใหม่</h2>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* ประเภทรายการ (Toggle Tab) */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-2">ประเภทรายการ</label>
                <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setType("MOVE_IN")}
                    className={`py-2 text-sm font-medium rounded-lg transition-all ${
                      type === "MOVE_IN" 
                        ? "bg-white text-green-700 shadow-sm" 
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    📥 รับเข้าสินค้า (Stock In)
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("MOVE_OUT")}
                    className={`py-2 text-sm font-medium rounded-lg transition-all ${
                      type === "MOVE_OUT" 
                        ? "bg-white text-red-600 shadow-sm" 
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    📤 เบิกออกสินค้า (Stock Out)
                  </button>
                </div>
              </div>

              {/* ชื่อสินค้า */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">ชื่อสินค้า / วัตถุดิบ</label>
                <input
                  type="text"
                  placeholder="เช่น ซอสปรุงรส, วัตถุดิบ A"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white py-2.5 px-4 text-sm outline-none focus:border-black transition"
                  required
                />
              </div>

              {/* จำนวน และ หน่วยสินค้า */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">จำนวน</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="0"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white py-2.5 px-4 text-sm outline-none focus:border-black transition"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">หน่วยนับ</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 text-sm outline-none focus:border-black transition"
                  >
                    <option value="ชิ้น">ชิ้น</option>
                    <option value="กล่อง">กล่อง</option>
                    <option value="ขวด">ขวด</option>
                    <option value="ถุง">ถุง</option>
                    <option value="ลัง">ลัง</option>
                    <option value="กิโลกรัม">กิโลกรัม (กก)</option>
                    <option value="แกลลอน">แกลลอน</option>
                  </select>
                </div>
              </div>

              {/* หมายเหตุ */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">หมายเหตุ (ถ้ามี)</label>
                <textarea
                  rows="2"
                  placeholder="เช่น เติมของเข้าร้าน, ของชำรุดเสียหาย, นำไปใช้ผลิต"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white py-2.5 px-4 text-sm outline-none focus:border-black transition resize-none"
                />
              </div>

              {/* ปุ่ม Submit */}
              <button
                type="submit"
                className="w-full rounded-2xl bg-black py-3 text-sm font-medium text-white hover:bg-gray-900 transition"
              >
                บันทึกรายการเคลื่อนไหว
              </button>
            </form>
          </div>

          {/* ฝั่งขวา: สรุปความรู้/ไกด์ไลน์รวดเร็ว (1 ส่วน) */}
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">ข้อควรระวังในการบันทึก</h3>
              <ul className="mt-3 space-y-2.5 text-xs text-gray-600 list-disc list-inside">
                <li>การ <span className="font-semibold text-green-700">รับเข้า</span> จะเพิ่มยอดคงเหลือในระบบสต็อกโดยอัตโนมัติ</li>
                <li>การ <span className="font-semibold text-red-600">เบิกออก</span> ยอดสินค้าต้องไม่ติดลบจากยอดคลังจริง</li>
                <li>ตรวจสอบหน่วยนับให้ถูกต้องทุกครั้งก่อนบันทึกเพื่อป้องกันข้อมูลรายงานเพี้ยน</li>
              </ul>
            </div>
            <div className="mt-6 border-t border-gray-200 pt-4 text-xs text-gray-400">
              <p>ผู้ทำรายการปัจจุบัน: <span className="text-gray-700 font-medium">DiaM Admin</span></p>
            </div>
          </div>
        </div>

        {/* ส่วนตาราง: ประวัติการเคลื่อนไหวล่าสุด */}
        <div className="mt-10">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">ประวัติการเคลื่อนไหวล่าสุดวันนี้</h2>
            <p className="text-sm text-gray-600">ตารางแสดงรายการเดินสต็อกสินค้าที่เกิดขึ้นล่าสุด</p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-4">ID รายการ</th>
                    <th className="px-6 py-4">เวลา</th>
                    <th className="px-6 py-4">ประเภท</th>
                    <th className="px-6 py-4">ชื่อสินค้า</th>
                    <th className="px-6 py-4 text-center">จำนวน</th>
                    <th className="px-6 py-4">หน่วย</th>
                    <th className="px-6 py-4">หมายเหตุ</th>
                    <th className="px-6 py-4">ผู้บันทึก</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition">
                      <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-gray-500">
                        {m.id}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600 text-xs">
                        {m.time}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {m.type === "MOVE_IN" ? (
                          <span className="inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                            📥 รับเข้า
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                            📤 เบิกออก
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {m.itemName}
                      </td>
                      <td className={`whitespace-nowrap px-6 py-4 text-center font-semibold ${
                        m.type === "MOVE_IN" ? "text-green-600" : "text-red-500"
                      }`}>
                        {m.type === "MOVE_IN" ? `+${m.qty}` : `-${m.qty}`}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-500">
                        {m.unit}
                      </td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                        {m.note}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-500 text-xs">
                        {m.user}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <p className="mt-8 text-xs text-gray-400 text-center">* หน้ารับเข้า/เบิกออกเวอร์ชันเดโม พร้อมใช้งานบนหน้าจอทุกขนาด</p>
      </section>
    </main>
  );
}