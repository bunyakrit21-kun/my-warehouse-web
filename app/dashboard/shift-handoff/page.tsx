"use client";

import { Suspense } from "react";
import ClosingContent from "../cash-closing/ClosingContent";

// นับเงินเปลี่ยนกะ: เช็คยอด ณ จุดส่งมอบระหว่างวัน — เงินไม่ถูกหยิบออก
// กะถัดไปรับช่วงต่อบนยอดนี้ (ปิดยอดสิ้นวันอยู่ที่ /dashboard/cash-closing)
export default function ShiftHandoffPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">กำลังโหลด...</div>}>
      <ClosingContent mode="handoff" />
    </Suspense>
  );
}
