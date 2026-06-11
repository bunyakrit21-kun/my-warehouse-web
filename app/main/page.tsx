"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const MENUS = [
  {
    title: "สต็อกสินค้า",
    desc: "ดูรายการสินค้า คงเหลือ และสถานะ",
    href: "/main/inventory",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7.5 12 3l9 4.5-9 4.5L3 7.5Z" />
        <path d="M3 7.5V16.5L12 21l9-4.5V7.5" />
        <path d="M12 7.5V21" />
      </svg>
    ),
  },
  {
    title: "รับเข้า / เบิกออก",
    desc: "บันทึกการเคลื่อนไหวสินค้า (Movement)",
    href: "/main/movement",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 7h10" />
        <path d="M7 12h10" />
        <path d="M7 17h6" />
        <path d="M4 4h16v16H4z" />
      </svg>
    ),
  },
  {
    title: "สแกนบาร์โค้ด",
    desc: "ค้นหา/เพิ่มสินค้าแบบเร็ว",
    href: "/main/scan",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7V5a1 1 0 0 1 1-1h2" />
        <path d="M20 7V5a1 1 0 0 0-1-1h-2" />
        <path d="M4 17v2a1 1 0 0 0 1 1h2" />
        <path d="M20 17v2a1 1 0 0 1-1 1h-2" />
        <path d="M7 12h10" />
      </svg>
    ),
  },
  {
    title: "รายงาน",
    desc: "สรุปสต็อกและการเคลื่อนไหว",
    href: "/main/reports",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19V5" />
        <path d="M8 19V9" />
        <path d="M12 19V12" />
        <path d="M16 19V7" />
        <path d="M20 19V10" />
      </svg>
    ),
  },
];

// กำหนดโครงสร้าง Type พื้นฐานสำหรับสินค้าเพื่อแก้บั๊ก TypeScript
interface SimpleProduct {
  stock: number;
}

const DEFAULT_PRODUCTS: SimpleProduct[] = [
  { stock: 150 }, { stock: 5 }, { stock: 420 }, { stock: 0 }, { stock: 8 }, { stock: 65 }, { stock: 3 }
];
const DEFAULT_MOVEMENTS = [{}, {}, {}, {}];

export default function MainHome() {
  const user = {
    name: "DiaM Admin",
    role: "Warehouse",
    email: "admin@diam.com",
  };

  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [movementCount, setMovementCount] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    // 1. คำนวณหาสินค้าใกล้หมด (ใส่ Type Assertion 'as SimpleProduct[]' เพื่อกำจัดข้อผิดพลาด)
    const savedProducts = localStorage.getItem("diam_products");
    const productsToUse = savedProducts ? (JSON.parse(savedProducts) as SimpleProduct[]) : DEFAULT_PRODUCTS;
    const lowStock = productsToUse.filter((p) => p.stock <= 10).length;
    setLowStockCount(lowStock);

    // 2. คำนวณจำนวนรายการเคลื่อนไหว
    const savedMovements = localStorage.getItem("diam_movements");
    const movementsToUse = savedMovements ? JSON.parse(savedMovements) : DEFAULT_MOVEMENTS;
    setMovementCount(movementsToUse.length);

    setIsLoaded(true);
  }, []);

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-gray-300 bg-gray-50">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-gray-700" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 11.5 12 5l8 6.5" />
                <path d="M6.5 10.8V19a1.3 1.3 0 0 0 1.3 1.3h8.4A1.3 1.3 0 0 0 17.5 19v-8.2" />
                <path d="M9 13.2h6" />
                <path d="M9 15.6h6" />
              </svg>
            </div>
            <div className="leading-tight">
              <p className="text-lg font-semibold tracking-tight">DiaM</p>
              <p className="text-xs text-gray-500">Smart Inventory System</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/main/profile" className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50">
              โปรไฟล์
            </Link>
            <Link href="/" className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900">
              ออกจากระบบ
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 rounded-3xl border border-gray-200 bg-white p-7 shadow-sm">
            <h1 className="text-3xl font-semibold tracking-tight">หน้าเริ่มต้น</h1>
            <p className="mt-2 text-gray-600">
              ยินดีต้อนรับ, <span className="font-medium text-gray-900">{user.name}</span> 👋
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700">Role: {user.role}</span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700">{user.email}</span>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/main/inventory" className="rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white hover:bg-gray-900 transition">
                ไปที่สต็อกสินค้า
              </Link>
              <Link href="/main/movement" className="rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium hover:bg-gray-50 transition">
                บันทึก Movement
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-7">
            <p className="text-sm font-medium text-gray-900">ภาพรวมปัจจุบัน</p>
            <div className="mt-4 grid gap-3">
              <Link href="/main/inventory" className="block rounded-2xl border border-gray-200 bg-white p-4 hover:border-gray-400 transition">
                <p className="text-xs text-gray-500">สินค้าใกล้หมด (ต่ำกว่า 10)</p>
                <p className="mt-1 text-2xl font-semibold text-amber-600">
                  {isLoaded ? lowStockCount : "..."}
                </p>
              </Link>
              <Link href="/main/movement" className="block rounded-2xl border border-gray-200 bg-white p-4 hover:border-gray-400 transition">
                <p className="text-xs text-gray-500">Movement สะสม</p>
                <p className="mt-1 text-2xl font-semibold">
                  {isLoaded ? movementCount : "..."}
                </p>
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">เมนู / ฟังก์ชัน</h2>
            <p className="text-sm text-gray-600">เลือกสิ่งที่ต้องการทำต่อ</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MENUS.map((m) => (
              <Link key={m.title} href={m.href} className="group rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl border border-gray-200 bg-gray-50 text-gray-700 group-hover:border-gray-300">
                    {m.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{m.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-600">{m.desc}</p>
                  </div>
                </div>
                <div className="mt-4 text-xs font-medium text-gray-900 underline decoration-gray-300 underline-offset-4">
                  เปิดเมนู →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}