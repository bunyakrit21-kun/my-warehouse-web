"use client";

import { Suspense } from "react";
import ClosingContent from "./ClosingContent";

// ปิดยอดสิ้นวัน: นับลิ้นชักครั้งสุดท้าย เก็บเงินส่วนเกินออกให้เจ้าของ เหลือ "เงินในเก๊ะ"
// (การนับส่งต่อระหว่างกะอยู่ที่ /dashboard/shift-handoff)
export default function CashClosingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">กำลังโหลด...</div>}>
      <ClosingContent mode="dayclose" />
    </Suspense>
  );
}
