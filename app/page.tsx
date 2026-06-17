"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Product {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  unit: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/api/products")
      .then(r => r.ok ? r.json() : [])
      .then(setProducts)
      .catch(console.error);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (!mounted) return <div className="p-8 text-center text-sm font-sans text-gray-400">กำลังประมวลผลแผงควบคุมระบบ...</div>;

  const criticalItems = products.filter((p) => p.stock <= p.minStock);
  const totalStockSum = products.reduce((acc, p) => acc + p.stock, 0);
  const totalMinSum = products.reduce((acc, p) => acc + p.minStock, 0) || 1;
  const inStockPercentage = Math.min(Math.round((totalStockSum / (totalStockSum + totalMinSum)) * 100), 100);
  const outStockPercentage = 100 - inStockPercentage;

  return (
    <main className="min-h-screen bg-gray-50 text-black font-sans antialiased pb-12">

      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white font-black text-base shadow-sm">D</div>
            <div className="leading-tight">
              <span className="font-bold text-gray-900">DiaM</span>
              <span className="text-gray-300 mx-2">|</span>
              <span className="text-xs text-gray-400 font-medium">Dashboard</span>
            </div>
          </div>
          <button onClick={handleLogout} className="text-xs font-bold text-gray-400 hover:text-black flex items-center gap-1 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            ออกจากระบบ
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-5 md:grid-cols-3 mb-6">

          {/* การ์ด 1: สินค้าทั้งหมด */}
          <Link href="/dashboard/inventory" className="block rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-black transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">สินค้าทั้งหมดในสต็อก</p>
                <p className="mt-2 text-4xl font-black text-gray-900 tracking-tight">{products.length} <span className="text-xs font-normal text-gray-400">รายการ</span></p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {criticalItems.length > 0 && (
                  <span className="inline-flex rounded-full bg-red-50 border border-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                    วิกฤต {criticalItems.length} รายการ
                  </span>
                )}
                <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-gray-400 mt-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-2">แจ้งเตือนสินค้าหมด / ใกล้หมดคลัง</p>
              {criticalItems.length === 0 ? (
                <p className="text-xs text-gray-400 font-medium">ปริมาณวัตถุดิบทุกรายการอยู่ในเกณฑ์ปกติ</p>
              ) : (
                <ul className="space-y-1.5 text-xs font-semibold text-gray-700">
                  {criticalItems.slice(0, 3).map((item) => (
                    <li key={item.id} className="flex justify-between items-center bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                      <span className="truncate max-w-[160px]">{item.name}</span>
                      <span className={`font-black ${item.stock === 0 ? "text-red-600" : "text-orange-500"}`}>{item.stock} {item.unit}</span>
                    </li>
                  ))}
                  {criticalItems.length > 3 && (
                    <li className="text-[10px] text-gray-400 text-right font-medium">+ มีอีก {criticalItems.length - 3} รายการที่ต้องเฝ้าระวัง</li>
                  )}
                </ul>
              )}
            </div>
          </Link>

          {/* การ์ด 2: รายการเคลื่อนไหว */}
          <Link href="/dashboard/movement" className="block rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-black transition-all">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">รายการนำเข้าและเบิกออกวันนี้</p>
            <div className="mt-4 flex items-baseline gap-4">
              <span className="text-3xl font-black text-green-600 tracking-tight">Stock In <span className="text-xs font-bold text-gray-400 block uppercase mt-0.5">เข้าคลัง</span></span>
            </div>
            <div className="mt-7 pt-4 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                กดเพื่อบันทึกรายการรับ/เบิกสินค้า
              </p>
            </div>
          </Link>

          {/* การ์ด 3: สถานะสินค้า */}
          <Link href="/dashboard/reports" className="block rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-black transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">สถานะสินค้าในคลัง</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-black text-gray-900">{products.length - criticalItems.length}</span>
                  <span className="text-sm text-gray-400">/ {products.length} รายการ</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">สินค้าที่สต็อกปกติ</p>
              </div>
              <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2zm9 0v-3a2 2 0 012-2h2a2 2 0 012 2v3a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>ปกติ</span>
                <span className="text-green-600">{products.length - criticalItems.length} รายการ</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>ใกล้หมด / หมด</span>
                <span className="text-red-500">{criticalItems.length} รายการ</span>
              </div>
            </div>
          </Link>

        </div>

        {/* notification bar */}
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 flex items-center gap-3 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
          <p className="text-xs font-semibold text-gray-500 leading-none">
            ระบบความปลอดภัยเปิดสแตนด์บาย: ข้อมูลประวัติการเบิกจ่ายและรายการแจ้งเตือนคลังสินค้าวิกฤตจะได้รับการอัปเดตแบบเรียลไทม์โดยอัตโนมัติ
          </p>
        </div>
      </section>
    </main>
  );
}