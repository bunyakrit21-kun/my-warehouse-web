"use client";

import { Suspense } from "react";
import MovementContent from "./MovementContent";

export default function MovementPage() {
  return (
    // ครอบ Suspense Boundary ไว้ตามคำสั่งของ Next.js เผื่อเวลาโหลดข้อมูลทางเทคนิค
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans text-sm text-gray-400">
        กำลังโหลดโครงสร้างระบบบันทึกคลัง...
      </div>
    }>
      <MovementContent />
    </Suspense>
  );
}