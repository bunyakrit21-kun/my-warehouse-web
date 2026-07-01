"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT, LangSwitcher } from "@/lib/i18n";

interface Product { id: string; name: string; stock: number; minStock: number; unit: string; }
interface Store { id: number; name: string; business_type: string; phone: string; my_role: string; }
interface User { id: number; name: string; email: string; role: string; }
interface Shift { id: number; name: string; start_time: string; end_time: string | null; color: string; }
interface ScheduleEntry { id: number; work_date: string; shift_id: number; user_id: number; user_name: string; }

const SHIFT_DOT_COLOR: Record<string, string> = {
  blue: "bg-blue-500", green: "bg-green-500", orange: "bg-orange-500", purple: "bg-purple-500", red: "bg-red-500",
};
const MONTH_TH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useT();
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [todayShifts, setTodayShifts] = useState<Shift[]>([]);
  const [todayEntries, setTodayEntries] = useState<ScheduleEntry[]>([]);
  const [todayDateStr, setTodayDateStr] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchProductsForStore = async (sid: number) => {
    const data = await fetch(`/api/products?storeId=${sid}`).then(r => r.ok ? r.json() : []);
    setProducts(data);
  };

  const fetchTodayScheduleForStore = async (sid: number) => {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setTodayDateStr(todayStr);
    const data = await fetch(`/api/schedule?storeId=${sid}&weekStart=${todayStr}&days=1`).then(r => r.ok ? r.json() : null);
    if (!data) return;
    setTodayShifts(data.shifts ?? []);
    setTodayEntries((data.entries ?? []).filter((e: ScheduleEntry) => e.work_date.slice(0, 10) === todayStr));
  };

  useEffect(() => {
    async function init() {
      const [meData, storesData] = await Promise.all([
        fetch("/api/auth/me").then(r => r.ok ? r.json() : null),
        fetch("/api/stores").then(r => r.ok ? r.json() : []),
      ]);
      if (!meData?.user) { router.push("/login"); return; }
      setUser(meData.user);
      setStores(storesData);
      const first: Store | null = storesData[0] ?? null;
      setCurrentStore(first);
      if (first) await Promise.all([fetchProductsForStore(first.id), fetchTodayScheduleForStore(first.id)]);
      setMounted(true);
    }
    init();
  }, [router]);

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (!mounted) return <div className="p-8 text-center text-gray-400">{t("loading")}</div>;

  const criticalItems = products.filter(p => p.stock <= p.minStock);

  const ROLE_LABEL: Record<string, string> = { owner: t("roleOwner"), admin: t("roleAdmin"), manager: t("roleManager"), staff: t("roleStaff") };

  const todayShiftChips = todayShifts.map(shift => ({
    shift,
    assigned: todayEntries.filter(e => e.shift_id === shift.id),
  }));
  const [todayYear, todayMonth, todayDay] = todayDateStr ? todayDateStr.split("-").map(Number) : [0, 0, 0];
  const todayThaiLabel = todayDateStr ? `${todayDay} ${MONTH_TH_SHORT[todayMonth - 1]}` : "";
  const todayMonthEn = todayDateStr
    ? new Date(todayYear, todayMonth - 1, todayDay).toLocaleDateString("en-US", { month: "short" }).toUpperCase()
    : "";

  const quickActions = [
    {
      key: "in",
      label: t("quickStockIn"),
      href: `/dashboard/movement?type=MOVE_IN${currentStore ? `&storeId=${currentStore.id}` : ""}`,
      box: "bg-green-50 border-green-100",
      icon: (
        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v10m0 0l-3.5-3.5M12 14l3.5-3.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 16v2a1 1 0 001 1h12a1 1 0 001-1v-2" />
        </svg>
      ),
    },
    {
      key: "out",
      label: t("quickStockOut"),
      href: `/dashboard/movement?type=MOVE_OUT${currentStore ? `&storeId=${currentStore.id}` : ""}`,
      box: "bg-red-50 border-red-100",
      icon: (
        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V10m0 0l-3.5 3.5M12 10l3.5 3.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 6V4a1 1 0 011-1h12a1 1 0 011 1v2" />
        </svg>
      ),
    },
    {
      key: "cash",
      label: t("quickCashOut"),
      href: `/dashboard/movement?type=CASH_OUT${currentStore ? `&storeId=${currentStore.id}` : ""}`,
      box: "bg-orange-50 border-orange-100",
      icon: (
        <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      ),
    },
    {
      key: "fresh",
      label: t("quickFreshCheck"),
      href: `/dashboard/fresh-check${currentStore ? `?storeId=${currentStore.id}` : ""}`,
      box: "bg-teal-50 border-teal-100",
      icon: <span className="text-xl">🥬</span>,
    },
    {
      key: "suggest",
      label: t("quickSuggestOrder"),
      href: `/dashboard/fresh-summary${currentStore ? `?storeId=${currentStore.id}` : ""}`,
      box: "bg-amber-50 border-amber-100",
      icon: <span className="text-xl">📊</span>,
    },
  ];

  return (
    <main className="min-h-screen bg-gray-50 text-black font-sans antialiased pb-12">

      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          
          {/* Logo + ชื่อร้าน */}
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white font-black text-base">D</div>
            <div className="leading-tight">
              <span className="font-bold text-gray-900">DiaM</span>
              <span className="text-gray-300 mx-2">|</span>
              <span className="text-xs text-gray-400 font-medium">
                {currentStore ? currentStore.name : "Dashboard"}
              </span>
            </div>
          </div>

          <LangSwitcher />

          {/* Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2 hover:border-gray-300 transition-all"
            >
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-black text-white text-xs font-black">
                {user?.name?.[0] ?? "U"}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-gray-800 leading-none">{user?.name ?? "User"}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{ROLE_LABEL[user?.role ?? "staff"]}</p>
              </div>
              <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-gray-200 bg-white shadow-lg z-50 overflow-hidden">
                
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="text-xs font-bold text-gray-900">{user?.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{user?.email}</p>
                  <span className="inline-flex mt-1.5 rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-white">
                    {ROLE_LABEL[user?.role ?? "staff"]}
                  </span>
                </div>

                {/* ร้านค้าที่มี */}
                {stores.length > 0 && (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{t("myStores")}</p>
                    {stores.map(store => (
                      <button
                        key={store.id}
                        onClick={() => { setCurrentStore(store); setDropdownOpen(false); fetchProductsForStore(store.id); fetchTodayScheduleForStore(store.id); }}
                        className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-xl mb-1 transition-all ${currentStore?.id === store.id ? "bg-black text-white" : "hover:bg-gray-50"}`}
                      >
                        <div>
                          <p className="text-xs font-bold">{store.name}</p>
                          <p className={`text-[10px] ${currentStore?.id === store.id ? "text-gray-300" : "text-gray-400"}`}>{store.business_type}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${currentStore?.id === store.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                          {ROLE_LABEL[store.my_role]}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* เมนู */}
                <div className="p-2">
                  <Link href="/dashboard/profile" onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition-all w-full text-left">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-sm font-semibold text-gray-700">{t("profileSettings")}</span>
                  </Link>
                  <Link href="/dashboard/stores" onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition-all w-full text-left">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="text-sm font-semibold text-gray-700">{t("manageStores")}</span>
                  </Link>
                  <button onClick={handleLogout}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-50 transition-all w-full text-left mt-1 border-t border-gray-100 pt-2">
                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span className="text-sm font-semibold text-red-500">{t("logout")}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-5 md:grid-cols-3 mb-6">

          {/* การ์ด 1: สินค้าทั้งหมด */}
          <Link href={`/dashboard/inventory${currentStore ? `?storeId=${currentStore.id}` : ""}`} className="block rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-black transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t("totalStockLabel")}</p>
                <p className="mt-2 text-4xl font-black text-gray-900 tracking-tight">{products.length} <span className="text-xs font-normal text-gray-400">{t("items")}</span></p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {criticalItems.length > 0 && (
                  <span className="inline-flex rounded-full bg-red-50 border border-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">{t("criticalBadge")} {criticalItems.length} {t("items")}</span>
                )}
                <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-gray-400 mt-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-2">{t("lowStockAlert")}</p>
              {criticalItems.length === 0 ? (
                <p className="text-xs text-gray-400">{t("stockNormal")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {criticalItems.slice(0, 3).map(item => (
                    <li key={item.id} className="flex justify-between text-xs font-semibold bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                      <span className="truncate max-w-[160px]">{item.name}</span>
                      <span className={item.stock === 0 ? "text-red-600 font-black" : "text-orange-500 font-black"}>{item.stock} {item.unit}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Link>

          {/* การ์ด 2: ทางลัดรับเข้า/เบิกออก/เบิกเงิน/เช็คของสด/แนะนำสั่ง */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">{t("stockInOutLabel")}</p>
            <div className="grid grid-cols-3 gap-3">
              {quickActions.map(action => (
                <Link key={action.key} href={action.href}
                  className="flex flex-col items-center gap-2 rounded-xl py-2 hover:bg-gray-50 transition-all">
                  <div className={`w-12 h-12 rounded-2xl border grid place-items-center ${action.box}`}>
                    {action.icon}
                  </div>
                  <span className="text-[11px] font-semibold text-gray-600 text-center leading-tight">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>
{/* การ์ด 3: สถานะสินค้า */}
          <Link href={`/dashboard/reports${currentStore ? `?storeId=${currentStore.id}` : ""}`} className="block rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-black transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t("stockStatusLabel")}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-black text-gray-900">{products.length - criticalItems.length}</span>
                  <span className="text-sm text-gray-400">/ {products.length} {t("items")}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{t("stockOkItems")}</p>
              </div>
              <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2zm9 0v-3a2 2 0 012-2h2a2 2 0 012 2v3a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>{t("normal")}</span>
                <span className="text-green-600">{products.length - criticalItems.length} {t("items")}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>{t("nearEmpty")}</span>
                <span className="text-red-500">{criticalItems.length} {t("items")}</span>
              </div>
            </div>
          </Link>

        </div>

        {/* การ์ด ตารางงาน */}
        <Link href={`/dashboard/schedule${currentStore ? `?storeId=${currentStore.id}` : ""}`} className="block rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-black transition-all mb-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="shrink-0">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">ตารางงาน</p>
              <p className="mt-1 text-lg font-black text-gray-900">จัดกะพนักงาน</p>
              <p className="text-xs text-gray-400 mt-0.5">วางแผนตารางงานรายสัปดาห์</p>
            </div>

            {todayShiftChips.length > 0 && (
              <div className="flex-1 min-w-[200px]">
                <p className="text-xs font-semibold text-gray-400 mb-2">วันนี้ทำงาน · {todayThaiLabel}</p>
                <div className="flex flex-wrap gap-2">
                  {todayShiftChips.flatMap(({ shift, assigned }) =>
                    assigned.length > 0
                      ? assigned.map(e => (
                          <div key={`e-${e.id}`} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full pl-1.5 pr-3 py-1.5">
                            <span className={`w-6 h-6 shrink-0 rounded-full grid place-items-center text-white text-[10px] font-bold ${SHIFT_DOT_COLOR[shift.color] ?? "bg-gray-400"}`}>
                              {e.user_name?.[0] ?? "?"}
                            </span>
                            <span className="text-xs font-bold text-gray-800">{e.user_name}</span>
                            <span className="text-[11px] text-gray-400">
                              {shift.start_time}{shift.end_time ? `–${shift.end_time}` : ""}
                            </span>
                          </div>
                        ))
                      : [
                          <div key={`u-${shift.id}`} className="flex items-center gap-1.5 bg-red-50 border border-red-100 text-red-600 rounded-full px-3 py-1.5">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <rect x="4" y="4" width="16" height="16" rx="3" />
                            </svg>
                            <span className="text-xs font-bold">ยังไม่มีคนกะ{shift.name}</span>
                          </div>,
                        ]
                  )}
                </div>
              </div>
            )}

            <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-center shrink-0">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-none">{todayMonthEn}</p>
              <p className="text-lg font-black text-gray-900 leading-tight mt-0.5">{todayDay || ""}</p>
            </div>
          </div>
        </Link>

        {/* การ์ด เช็คของสด */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <Link href={`/dashboard/fresh-check${currentStore ? `?storeId=${currentStore.id}` : ""}`} className="block rounded-2xl border border-green-100 bg-green-50 p-5 shadow-sm hover:border-green-400 transition-all">
            <div className="text-2xl mb-2">🥬</div>
            <p className="text-xs font-bold text-green-700 uppercase tracking-wider">{t("freshCheckTitle")}</p>
            <p className="text-xs text-green-600/70 mt-0.5">{t("freshCheckDesc")}</p>
          </Link>
          <Link href={`/dashboard/fresh-summary${currentStore ? `?storeId=${currentStore.id}` : ""}`} className="block rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm hover:border-amber-400 transition-all">
            <div className="text-2xl mb-2">📊</div>
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">{t("freshSummaryTitle")}</p>
            <p className="text-xs text-amber-600/70 mt-0.5">{t("freshViewSummary")}</p>
          </Link>
        </div>

        {/* notification bar */}
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 flex items-center gap-3 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
          <p className="text-xs font-semibold text-gray-500">
            {t("systemAlert")}
          </p>
        </div>
      </section>
    </main>
  );
}