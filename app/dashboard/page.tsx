"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT, LangSwitcher } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { DEFAULT_COUNTRY_CODE } from "@/lib/countries";

interface Product { id: string; name: string; stock: number; minStock: number; unit: string; }
interface Store { id: number; name: string; business_type: string; phone: string; my_role: string; country: string | null; logo_thumbnail: string | null; }
interface User { id: number; name: string; email: string; role: string; }
interface Shift { id: number; name: string; start_time: string; end_time: string | null; color: string; }
interface ScheduleEntry { id: number; work_date: string; shift_id: number; user_id: number; user_name: string; }
interface FlaggedClosing {
  id: number;
  businessDate: string;
  difference: string;
  scheduleMismatch: boolean;
  createdAt: string;
  shiftName: string | null;
  closedByName: string | null;
}

const DAY_TH_SHORT = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useT();
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [weekShifts, setWeekShifts] = useState<Shift[]>([]);
  const [weekEntries, setWeekEntries] = useState<ScheduleEntry[]>([]);
  const [todayDateStr, setTodayDateStr] = useState("");
  const [flaggedClosings, setFlaggedClosings] = useState<FlaggedClosing[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchProductsForStore = async (sid: number) => {
    const data = await fetch(`/api/products?storeId=${sid}`).then(r => r.ok ? r.json() : []);
    setProducts(data);
  };

  const fetchFlaggedClosingsForStore = async (sid: number) => {
    const data = await fetch(`/api/cash-closings/flagged?storeId=${sid}`).then(r => r.ok ? r.json() : []);
    setFlaggedClosings(data);
  };

  const acknowledgeClosing = async (id: number) => {
    const removed = flaggedClosings.find(c => c.id === id);
    setFlaggedClosings(prev => prev.filter(c => c.id !== id));
    const res = await fetch(`/api/cash-closings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acknowledge: true }),
    });
    if (!res.ok && removed) {
      // Revert the optimistic removal so a failed acknowledge doesn't silently vanish from view.
      setFlaggedClosings(prev => [...prev, removed].sort((a, b) => b.id - a.id));
    }
  };

  const fetchWeekScheduleForStore = async (sid: number) => {
    const todayStr = formatDateStr(new Date());
    setTodayDateStr(todayStr);
    const weekStart = formatDateStr(getMondayOf(new Date()));
    const data = await fetch(`/api/schedule?storeId=${sid}&weekStart=${weekStart}&days=7`).then(r => r.ok ? r.json() : null);
    if (!data) return;
    setWeekShifts(data.shifts ?? []);
    setWeekEntries(data.entries ?? []);
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
      if (first) await Promise.all([fetchProductsForStore(first.id), fetchWeekScheduleForStore(first.id), fetchFlaggedClosingsForStore(first.id)]);
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

  const outOfStock = products.filter(p => p.stock === 0);
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.minStock);
  const criticalItems = products.filter(p => p.stock <= p.minStock);
  const normalStock = products.length - criticalItems.length;
  const stockTotal = products.length || 1;

  const ROLE_LABEL: Record<string, string> = { owner: t("roleOwner"), admin: t("roleAdmin"), manager: t("roleManager"), staff: t("roleStaff") };

  // Mini week calendar for the schedule card
  const weekStartDate = getMondayOf(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
  const entriesOn = (dateStr: string) => weekEntries.filter(e => e.work_date.slice(0, 10) === dateStr);
  const todayEntries = entriesOn(todayDateStr);
  const todayNames = Array.from(new Set(todayEntries.map(e => e.user_name)));

  const stockCashActions = [
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
  ];

  const freshActions = [
    {
      key: "fresh",
      label: t("quickFreshCheck"),
      desc: t("freshCheckDesc"),
      href: `/dashboard/fresh-check${currentStore ? `?storeId=${currentStore.id}` : ""}`,
      box: "bg-teal-50 border-teal-100",
      icon: <span className="text-xl">🥬</span>,
    },
    {
      key: "suggest",
      label: t("quickSuggestOrder"),
      desc: t("freshViewSummary"),
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
            {currentStore?.logo_thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentStore.logo_thumbnail} alt="" className="h-10 w-10 rounded-xl object-cover border border-gray-200" />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white font-black text-base">D</div>
            )}
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
                        onClick={() => { setCurrentStore(store); setDropdownOpen(false); fetchProductsForStore(store.id); fetchWeekScheduleForStore(store.id); fetchFlaggedClosingsForStore(store.id); }}
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

        {/* สรุปสต็อก — แผนภาพสรุปเดียว */}
        <Link href={`/dashboard/inventory${currentStore ? `?storeId=${currentStore.id}` : ""}`}
          className="block rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-black transition-all mb-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t("totalStockLabel")}</p>
            <span className="text-xs font-semibold text-gray-400">{t("stockStatusLabel")} →</span>
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-4xl font-black text-gray-900 tracking-tight">{products.length}</span>
            <span className="text-xs font-normal text-gray-400">{t("items")}</span>
          </div>

          {/* แถบสัดส่วนสต็อก */}
          <div className="flex h-3 w-full rounded-full overflow-hidden bg-gray-100">
            {normalStock > 0 && <div className="bg-green-500" style={{ width: `${(normalStock / stockTotal) * 100}%` }} />}
            {lowStock.length > 0 && <div className="bg-orange-400" style={{ width: `${(lowStock.length / stockTotal) * 100}%` }} />}
            {outOfStock.length > 0 && <div className="bg-red-500" style={{ width: `${(outOfStock.length / stockTotal) * 100}%` }} />}
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              <span className="text-xs text-gray-500">{t("normal")}</span>
              <span className="text-xs font-bold text-gray-900 ml-auto">{normalStock}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
              <span className="text-xs text-gray-500">{t("nearEmpty")}</span>
              <span className="text-xs font-bold text-gray-900 ml-auto">{lowStock.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <span className="text-xs text-gray-500">{t("outOfStock")}</span>
              <span className="text-xs font-bold text-gray-900 ml-auto">{outOfStock.length}</span>
            </div>
          </div>

          {criticalItems.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-2">{t("lowStockAlert")}</p>
              <ul className="space-y-1.5">
                {criticalItems.slice(0, 3).map(item => (
                  <li key={item.id} className="flex justify-between text-xs font-semibold bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                    <span className="truncate max-w-[160px]">{item.name}</span>
                    <span className={item.stock === 0 ? "text-red-600 font-black" : "text-orange-500 font-black"}>{item.stock} {item.unit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Link>

        {/* การ์ด ปิดยอดเงินสด (แยกไว้ต่างหาก) */}
        <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm mb-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t("quickCashClosing")}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t("cashClosingAlertsTitle")}</p>
            </div>
            <div className="flex items-center gap-2">
              {flaggedClosings.length > 0 && (
                <span className="inline-flex rounded-full bg-red-50 border border-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                  {t("cashClosingAlertBadge")} {flaggedClosings.length}
                </span>
              )}
              <Link href={`/dashboard/cash-closing${currentStore ? `?storeId=${currentStore.id}` : ""}`}
                className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 transition-all flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l2.5 2.5L16 9" />
                </svg>
                {t("quickCashClosing")}
              </Link>
            </div>
          </div>
          {flaggedClosings.length === 0 ? (
            <p className="text-xs text-gray-400">{t("noCashClosingAlerts")}</p>
          ) : (
            <ul className="space-y-2">
              {flaggedClosings.map(c => (
                <li key={c.id} className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">
                      {c.businessDate.slice(0, 10)} · {c.shiftName ?? "-"} · {c.closedByName ?? "-"}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {c.scheduleMismatch && (
                        <span className="inline-flex rounded-full bg-orange-50 border border-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-600">
                          {t("scheduleMismatchLabel")}
                        </span>
                      )}
                      {Number(c.difference) !== 0 && (
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${Number(c.difference) > 0 ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-red-50 border-red-100 text-red-600"}`}>
                          {t("discrepancyAmountLabel")} {Number(c.difference) > 0 ? "+" : "-"}{formatCurrency(Math.abs(Number(c.difference)), currentStore?.country ?? DEFAULT_COUNTRY_CODE)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => acknowledgeClosing(c.id)}
                    className="shrink-0 rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-[11px] font-bold text-gray-600 hover:border-black transition-all"
                  >
                    {t("acknowledgeBtn")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* การ์ดใหญ่ ตารางงาน — ปฏิทินรายสัปดาห์ */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm mb-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">ตารางงาน</p>
              <p className="mt-1 text-lg font-black text-gray-900">จัดกะพนักงานสัปดาห์นี้</p>
            </div>
            <Link href={`/dashboard/schedule${currentStore ? `?storeId=${currentStore.id}` : ""}`}
              className="text-xs font-bold text-gray-500 hover:text-black transition-colors flex items-center gap-1">
              ดูตารางเต็ม
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((d, i) => {
              const dateStr = formatDateStr(d);
              const isToday = dateStr === todayDateStr;
              const names = Array.from(new Set(entriesOn(dateStr).map(e => e.user_name)));
              return (
                <div key={i} className={`rounded-xl border p-2.5 min-h-[92px] flex flex-col ${isToday ? "border-black bg-gray-50" : "border-gray-100"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold uppercase ${isToday ? "text-black" : "text-gray-400"}`}>{DAY_TH_SHORT[i]}</span>
                    <span className={`text-xs font-black w-5 h-5 rounded-full grid place-items-center ${isToday ? "bg-black text-white" : "text-gray-700"}`}>{d.getDate()}</span>
                  </div>
                  <div className="mt-1.5 flex flex-col gap-1 flex-1">
                    {names.length === 0 ? (
                      weekShifts.length > 0 && <span className="text-[10px] text-gray-300 mt-1">ว่าง</span>
                    ) : (
                      <>
                        {names.slice(0, 2).map(n => (
                          <span key={n} className="text-[10px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-md px-1.5 py-0.5 truncate">{n}</span>
                        ))}
                        {names.length > 2 && <span className="text-[10px] text-gray-400 font-semibold">+{names.length - 2} คน</span>}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {todayNames.length > 0 && (
            <p className="text-xs text-gray-400 mt-4">
              <span className="font-semibold text-gray-600">วันนี้ทำงาน:</span> {todayNames.join(", ")}
            </p>
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-2 mb-5">

          {/* การ์ด รับเข้า/เบิกออก/เบิกเงิน */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">{t("stockInOutLabel")}</p>
            <div className="grid grid-cols-3 gap-3">
              {stockCashActions.map(action => (
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

          {/* การ์ด เช็คของสด + แนะนำสั่ง */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">ของสดประจำวัน</p>
            <div className="grid grid-cols-2 gap-3">
              {freshActions.map(action => (
                <Link key={action.key} href={action.href}
                  className={`rounded-xl border p-4 hover:border-current transition-all ${action.box}`}>
                  <div className="text-xl mb-1.5">{action.icon}</div>
                  <p className="text-xs font-bold text-gray-800">{action.label}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{action.desc}</p>
                </Link>
              ))}
            </div>
          </div>

        </div>

        {/* การ์ดใหญ่ ระบบบัญชี — WIP */}
        <Link href={`/dashboard/accounting${currentStore ? `?storeId=${currentStore.id}` : ""}`}
          className="block rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 border border-indigo-200 grid place-items-center shrink-0">
                <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m-4-4h8" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-base font-black text-gray-900">{t("quickAccounting")}</p>
                  <span className="inline-flex rounded-full bg-indigo-100 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-600">กำลังพัฒนา</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">บัญชี รายรับ-รายจ่าย และยอดคงเหลือทุกบัญชีของร้าน</p>
              </div>
            </div>
            <span className="text-xs font-bold text-indigo-600 flex items-center gap-1 shrink-0">
              เปิดระบบบัญชี
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7" /></svg>
            </span>
          </div>
        </Link>

      </section>
    </main>
  );
}