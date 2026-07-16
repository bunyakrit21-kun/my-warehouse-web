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
interface ScheduleEntry { id: number; work_date: string; shift_id: number; user_id: number; user_name: string; }
interface Shift { id: number; name: string; start_time: string; end_time: string; color: string; }
interface FlaggedClosing { id: number; }
interface DayMovement { date: string; label: string; isToday: boolean; in: number; out: number; }
interface MovementSummary { days: DayMovement[]; todayIn: number; todayOut: number; }
interface CashClosing {
  id: number; businessDate: string; countedAmount: string; expectedAmount: string;
  difference: string; shiftName: string | null; closedByName: string | null; createdAt: string;
}
interface OverdueShift { overdue: boolean; shift: { id: number; name: string } | null; }
interface ShiftClosingInfo {
  id: number; countedAmount: number; shiftCash: number; difference: number;
  closedByName: string | null; createdAt: string;
}
interface ShiftTodayStatus {
  id: number; name: string; startTime: string; endTime: string | null; color: string | null;
  isCurrent: boolean; scheduledStaff: string[]; closing: ShiftClosingInfo | null;
}
interface TodayStatus { businessDate: string; shifts: ShiftTodayStatus[]; }
interface Transaction { id: number; type: "income" | "expense" | "transfer"; amount: string; }
interface AccountingSummary { income: number; expense: number; count: number; }

type StockStatus = "crit" | "warn" | "ok";

const SHIFT_COLORS: Record<string, { dot: string; chip: string }> = {
  blue: { dot: "bg-blue-500", chip: "bg-blue-50 text-blue-700" },
  green: { dot: "bg-green-500", chip: "bg-green-50 text-green-700" },
  orange: { dot: "bg-orange-500", chip: "bg-orange-50 text-orange-700" },
  purple: { dot: "bg-purple-500", chip: "bg-purple-50 text-purple-700" },
  red: { dot: "bg-red-500", chip: "bg-red-50 text-red-700" },
};

const WEEKDAY_TH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const MONTH_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayLabel(d: Date, isToday: boolean): string {
  const base = `${WEEKDAY_TH[d.getDay()]} ${d.getDate()} ${MONTH_TH[d.getMonth()]}`;
  return isToday ? `${base} (วันนี้)` : base;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} น.`;
}

function stockStatus(p: Product): StockStatus {
  if (p.stock <= p.minStock * 0.5) return "crit";
  if (p.stock <= p.minStock) return "warn";
  return "ok";
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
  const [todayEntries, setTodayEntries] = useState<ScheduleEntry[]>([]);
  const [scheduleDays, setScheduleDays] = useState<{ date: string; entries: ScheduleEntry[] }[]>([]);
  const [shiftsById, setShiftsById] = useState<Record<number, Shift>>({});
  const [flaggedClosings, setFlaggedClosings] = useState<FlaggedClosing[]>([]);
  const [movementSummary, setMovementSummary] = useState<MovementSummary | null>(null);
  const [latestClosing, setLatestClosing] = useState<CashClosing | null>(null);
  const [accountingSummary, setAccountingSummary] = useState<AccountingSummary | null>(null);
  const [overdueShift, setOverdueShift] = useState<OverdueShift["shift"]>(null);
  const [todayStatus, setTodayStatus] = useState<TodayStatus | null>(null);
  const [stockSearch, setStockSearch] = useState("");
  const [stockTab, setStockTab] = useState<"all" | StockStatus>("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchProductsForStore = async (sid: number) => {
    const data = await fetch(`/api/products?storeId=${sid}`).then(r => r.ok ? r.json() : []);
    setProducts(data);
  };

  const fetchFlaggedClosingsForStore = async (sid: number) => {
    const data = await fetch(`/api/cash-closings/flagged?storeId=${sid}`).then(r => r.ok ? r.json() : []);
    setFlaggedClosings(data);
  };

  const fetchScheduleForStore = async (sid: number) => {
    const todayStr = formatDateStr(new Date());
    const data = await fetch(`/api/schedule?storeId=${sid}&weekStart=${todayStr}&days=4`).then(r => r.ok ? r.json() : null);
    if (!data) { setScheduleDays([]); setShiftsById({}); setTodayEntries([]); return; }
    const shiftMap: Record<number, Shift> = {};
    for (const s of data.shifts ?? []) shiftMap[s.id] = s;
    setShiftsById(shiftMap);
    const entries: ScheduleEntry[] = data.entries ?? [];
    setTodayEntries(entries.filter((e: ScheduleEntry) => e.work_date.slice(0, 10) === todayStr));
    const days = Array.from({ length: 4 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = formatDateStr(d);
      return { date: dateStr, entries: entries.filter((e: ScheduleEntry) => e.work_date.slice(0, 10) === dateStr) };
    });
    setScheduleDays(days);
  };

  const fetchMovementsSummaryForStore = async (sid: number) => {
    const data = await fetch(`/api/movements/summary?storeId=${sid}&days=6`).then(r => r.ok ? r.json() : null);
    setMovementSummary(data);
  };

  const fetchLatestClosingForStore = async (sid: number) => {
    const data = await fetch(`/api/cash-closings/history?storeId=${sid}`).then(r => r.ok ? r.json() : null);
    setLatestClosing(Array.isArray(data) && data.length > 0 ? data[0] : null);
  };

  const fetchAccountingSummaryForStore = async (sid: number) => {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const to = formatDateStr(now);
    const data: Transaction[] | null = await fetch(`/api/transactions?storeId=${sid}&from=${from}&to=${to}`).then(r => r.ok ? r.json() : null);
    if (!Array.isArray(data)) { setAccountingSummary(null); return; }
    const income = data.filter(tx => tx.type === "income").reduce((s, tx) => s + Number(tx.amount), 0);
    const expense = data.filter(tx => tx.type === "expense").reduce((s, tx) => s + Number(tx.amount), 0);
    setAccountingSummary({ income, expense, count: data.length });
  };

  const fetchTodayStatusForStore = async (sid: number) => {
    const data: TodayStatus | null = await fetch(`/api/cash-closings/today-status?storeId=${sid}`).then(r => r.ok ? r.json() : null);
    setTodayStatus(data);
  };

  const fetchOverdueShiftForStore = async (sid: number) => {
    const data: OverdueShift | null = await fetch(`/api/cash-closings/overdue?storeId=${sid}`).then(r => r.ok ? r.json() : null);
    setOverdueShift(data?.overdue ? data.shift : null);
  };

  const loadStoreData = (sid: number) => Promise.all([
    fetchProductsForStore(sid),
    fetchScheduleForStore(sid),
    fetchFlaggedClosingsForStore(sid),
    fetchMovementsSummaryForStore(sid),
    fetchLatestClosingForStore(sid),
    fetchAccountingSummaryForStore(sid),
    fetchOverdueShiftForStore(sid),
    fetchTodayStatusForStore(sid),
  ]);

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
      if (first) await loadStoreData(first.id);
      setMounted(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const country = currentStore?.country ?? DEFAULT_COUNTRY_CODE;
  const productsWithStatus = products.map(p => ({ ...p, status: stockStatus(p) }));
  const critItems = productsWithStatus.filter(p => p.status === "crit");
  const warnItems = productsWithStatus.filter(p => p.status === "warn");
  const okItems = productsWithStatus.filter(p => p.status === "ok");
  const criticalItems = critItems;

  const filteredStock = productsWithStatus.filter(p =>
    (stockTab === "all" || p.status === stockTab) &&
    p.name.toLowerCase().includes(stockSearch.toLowerCase())
  );

  const STATUS_STYLE: Record<StockStatus, { bar: string; text: string; fill: string; label: string }> = {
    crit: { bar: "bg-red-600", text: "text-red-600", fill: "bg-red-600", label: "วิกฤต" },
    warn: { bar: "bg-orange-500", text: "text-orange-500", fill: "bg-orange-500", label: "ใกล้หมด" },
    ok: { bar: "bg-green-600", text: "text-green-600", fill: "bg-green-600", label: "ปกติ" },
  };

  const totalStock = products.length || 1;
  const donutSegments: { key: StockStatus; pct: number; color: string; offset: number }[] = (() => {
    const raw: { key: StockStatus; pct: number; color: string }[] = [
      { key: "ok", pct: Math.round((okItems.length / totalStock) * 100), color: "#16a34a" },
      { key: "warn", pct: Math.round((warnItems.length / totalStock) * 100), color: "#f97316" },
      { key: "crit", pct: Math.round((critItems.length / totalStock) * 100), color: "#dc2626" },
    ];
    let cursor = 0;
    return raw.map(it => {
      const offset = (25 - cursor + 100) % 100;
      cursor += it.pct;
      return { ...it, offset };
    });
  })();

  const ROLE_LABEL: Record<string, string> = { owner: t("roleOwner"), admin: t("roleAdmin"), manager: t("roleManager"), staff: t("roleStaff") };

  const q = currentStore ? `?storeId=${currentStore.id}` : "";
  const qAmp = currentStore ? `&storeId=${currentStore.id}` : "";

  const quickActions = [
    {
      key: "in", label: t("quickStockIn"), href: `/dashboard/movement?type=MOVE_IN${qAmp}`, box: "bg-green-50 border-green-100 text-green-600",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v10m0 0l-3.5-3.5M12 14l3.5-3.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 16v2a1 1 0 001 1h12a1 1 0 001-1v-2" />
        </svg>
      ),
    },
    {
      key: "out", label: t("quickStockOut"), href: `/dashboard/movement?type=MOVE_OUT${qAmp}`, box: "bg-red-50 border-red-100 text-red-600",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V10m0 0l-3.5 3.5M12 10l3.5 3.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 6V4a1 1 0 011-1h12a1 1 0 011 1v2" />
        </svg>
      ),
    },
    {
      key: "cash", label: t("quickCashOut"), href: `/dashboard/movement?type=CASH_OUT${qAmp}`, box: "bg-orange-50 border-orange-100 text-orange-600",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" />
        </svg>
      ),
    },
    {
      key: "fresh", label: t("quickFreshCheck"), href: `/dashboard/fresh-check${q}`, box: "bg-teal-50 border-teal-100 text-teal-600",
      icon: <span className="text-xl leading-none">🥬</span>,
    },
    {
      key: "suggest", label: t("quickSuggestOrder"), href: `/dashboard/fresh-summary${q}`, box: "bg-amber-50 border-amber-100 text-amber-600",
      icon: <span className="text-xl leading-none">📊</span>,
    },
    {
      key: "payroll", label: "เงินเดือน", href: `/dashboard/payroll${q}`, box: "bg-indigo-50 border-indigo-100 text-indigo-600",
      icon: <span className="text-xl leading-none">💵</span>,
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
                        onClick={() => { setCurrentStore(store); setDropdownOpen(false); loadStoreData(store.id); }}
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

      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-4">

        {/* แถบแจ้งเตือน — โชว์เฉพาะตอนมีอะไรต้องดู */}
        {(criticalItems.length > 0 || flaggedClosings.length > 0 || overdueShift) && (
          <div className="flex flex-wrap gap-2">
            {overdueShift && (
              <Link href={`/dashboard/shift-handoff${q}`}
                className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-700 hover:border-amber-400 transition-all">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                ถึงเวลาปิดกะ &quot;{overdueShift.name}&quot; แล้ว
              </Link>
            )}
            {criticalItems.length > 0 && (
              <Link href={`/dashboard/inventory${q}`}
                className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-600 hover:border-red-300 transition-all">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {t("lowStockAlert")} {criticalItems.length} {t("items")}
              </Link>
            )}
            {flaggedClosings.length > 0 && (
              <Link href={`/dashboard/cash-closing/history${q}`}
                className="flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-3.5 py-2 text-xs font-bold text-orange-600 hover:border-orange-300 transition-all">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                {t("cashClosingAlertBadge")} {flaggedClosings.length}
              </Link>
            )}
          </div>
        )}

        {/* แถวบน: สต็อก | quick actions + สถานะคลัง | ปิดยอดล่าสุด */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_260px] gap-4 items-start">

          {/* สต็อก */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-800">สต็อก</span>
              {criticalItems.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">{criticalItems.length} วิกฤต</span>
              )}
            </div>
            <div className="px-3 py-2 border-b border-gray-100">
              <input
                type="text"
                value={stockSearch}
                onChange={e => setStockSearch(e.target.value)}
                placeholder="ค้นหาสินค้า…"
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-gray-400"
              />
            </div>
            <div className="flex border-b border-gray-100 text-[10px] font-semibold">
              {([["all", "ทั้งหมด"], ["crit", "วิกฤต"], ["warn", "ใกล้หมด"], ["ok", "ปกติ"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setStockTab(key)}
                  className={`flex-1 py-2 text-center border-b-2 transition-colors ${
                    stockTab === key
                      ? key === "all" ? "border-black text-black"
                        : `${STATUS_STYLE[key].text} border-current`
                      : "border-transparent text-gray-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              {filteredStock.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  {products.length === 0 ? "ยังไม่มีสินค้า" : "ไม่พบสินค้า"}
                </div>
              ) : filteredStock.map(p => {
                const style = STATUS_STYLE[p.status];
                const pct = Math.min(100, Math.round((p.stock / (p.minStock * 2 || 1)) * 100));
                return (
                  <div key={p.id} className="flex items-center gap-2.5 px-3 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <span className={`w-1 h-8 rounded-full flex-shrink-0 ${style.bar}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{p.unit} · ขั้นต่ำ {p.minStock}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-sm font-bold leading-none ${style.text}`}>{p.stock}</span>
                      <div className="w-12 h-1 rounded-full bg-gray-100 overflow-hidden">
                        <div className={`h-full rounded-full ${style.fill}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
              <Link href={`/dashboard/inventory${q}`} className="text-[10px] font-semibold text-gray-500 hover:text-black">ดูทั้งหมด →</Link>
              <Link href={`/dashboard/movement?type=MOVE_IN${qAmp}`} className="flex items-center gap-1 text-[10px] font-semibold bg-black text-white rounded-lg px-2.5 py-1.5">
                + รับเข้า
              </Link>
            </div>
          </div>

          {/* กลาง: quick actions + สถานะคลัง */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {quickActions.map(item => (
                <Link key={item.key} href={item.href}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm hover:border-black transition-all">
                  <div className={`w-9 h-9 rounded-xl border grid place-items-center ${item.box}`}>
                    {item.icon}
                  </div>
                  <span className="text-[10px] font-semibold text-gray-700 text-center leading-tight">{item.label}</span>
                </Link>
              ))}
            </div>

            {/* สถานะคลังสินค้า */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex-1">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-800">สถานะคลังสินค้า</span>
                <Link href={`/dashboard/reports${q}`} className="text-[10px] font-semibold text-gray-400 hover:text-black">ดูรายงาน →</Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2">
                <div className="flex flex-col items-center justify-center gap-2 p-4 border-b sm:border-b-0 sm:border-r border-gray-100">
                  <div className="relative w-24 h-24">
                    <svg viewBox="0 0 42 42" width="96" height="96">
                      <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="5" />
                      {products.length > 0 && donutSegments.map(seg => (
                        <circle key={seg.key} cx="21" cy="21" r="15.9" fill="none" stroke={seg.color} strokeWidth="5"
                          strokeDasharray={`${seg.pct} ${100 - seg.pct}`} strokeDashoffset={seg.offset} />
                      ))}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold leading-none">{products.length > 0 ? `${Math.round((okItems.length / totalStock) * 100)}%` : "–"}</span>
                      <span className="text-[9px] text-gray-400 mt-1">สต็อกปกติ</span>
                    </div>
                  </div>
                  <div className="flex gap-3 flex-wrap justify-center text-[10px] text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-green-600" />ปกติ {okItems.length}</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-orange-500" />ใกล้หมด {warnItems.length}</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-red-600" />วิกฤต {critItems.length}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 p-4 justify-center">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-500">รับเข้าวันนี้</span>
                    <span className="text-xs font-bold text-green-600">{movementSummary ? `+${movementSummary.todayIn} รายการ` : "–"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-500">เบิกออกวันนี้</span>
                    <span className="text-xs font-bold text-red-600">{movementSummary ? `−${movementSummary.todayOut} รายการ` : "–"}</span>
                  </div>
                  <div className="border-t border-gray-100 pt-2.5">
                    {movementSummary ? (
                      <>
                        <div className="flex items-end gap-1 h-9">
                          {movementSummary.days.map(d => {
                            const max = Math.max(1, ...movementSummary.days.map(x => x.in + x.out));
                            const h = Math.max(6, Math.round(((d.in + d.out) / max) * 100));
                            return (
                              <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.label}: รับ ${d.in} / เบิก ${d.out}`}>
                                <div className={`w-full rounded-t-sm ${d.isToday ? "bg-blue-600" : "bg-blue-200"}`} style={{ height: `${h}%` }} />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {movementSummary.days.map(d => (
                            <span key={d.date} className="flex-1 text-center text-[8px] text-gray-400 truncate">{d.label}</span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-[10px] text-gray-400 text-center">ไม่มีข้อมูลความเคลื่อนไหว</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ปิดกะวันนี้ — สถานะทุกกะ เชื่อมตารางเวร + การปิดยอด */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-800">ปิดกะวันนี้</span>
              {todayStatus && <span className="text-[10px] text-gray-400">{String(todayStatus.businessDate).slice(0, 10)}</span>}
            </div>
            {todayStatus && todayStatus.shifts.length > 0 ? (
              <div className="flex flex-col">
                {todayStatus.shifts.map(s => (
                  <div key={s.id} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-50 last:border-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color || "#9ca3af" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {s.name}{" "}
                        <span className="text-[10px] font-normal text-gray-400">
                          {s.startTime.slice(0, 5)}{s.endTime ? `–${s.endTime.slice(0, 5)}` : ""}
                        </span>
                      </p>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">
                        {s.closing
                          ? `ปิดโดย ${s.closing.closedByName ?? "–"} · ${formatTime(s.closing.createdAt)}`
                          : s.scheduledStaff.length > 0
                            ? `เวร: ${s.scheduledStaff.join(", ")}`
                            : "ยังไม่จัดเวร"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      {s.closing ? (
                        <>
                          <span className="text-xs font-bold text-gray-900">{formatCurrency(s.closing.shiftCash, country)}</span>
                          <span className={`text-[9px] font-bold ${s.closing.difference === 0 ? "text-emerald-600" : s.closing.difference > 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {s.closing.difference === 0 ? "ยอดตรง" : `${s.closing.difference > 0 ? "+" : "-"}${formatCurrency(Math.abs(s.closing.difference), country)}`}
                          </span>
                        </>
                      ) : s.isCurrent ? (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">กำลังเปิด</span>
                      ) : (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-100">รอปิด</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : latestClosing ? (
              <div className="p-4 flex flex-col gap-1">
                <p className="text-lg font-bold">{formatCurrency(Number(latestClosing.countedAmount), country)}</p>
                <p className="text-[10px] text-gray-400">{latestClosing.businessDate}{latestClosing.shiftName ? ` · ${latestClosing.shiftName}` : ""}</p>
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
                  <div className="w-5 h-5 rounded-md bg-black text-white text-[9px] font-bold grid place-items-center flex-shrink-0">
                    {latestClosing.closedByName?.[0] ?? "?"}
                  </div>
                  <span className="text-[10px] text-gray-500">{latestClosing.closedByName ?? "–"} · {formatTime(latestClosing.createdAt)}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 text-xs text-gray-400">ยังไม่มีการปิดยอด</div>
            )}
            <div className="flex border-t border-gray-100 mt-auto">
              <Link href={`/dashboard/shift-handoff${q}`} className="flex-1 text-center text-[10px] font-semibold py-2 hover:bg-gray-50 text-gray-500">
                นับส่งต่อกะ
              </Link>
              <Link href={`/dashboard/cash-closing${q}`} className="flex-1 text-center text-[10px] font-semibold py-2 border-l border-gray-100 hover:bg-gray-50">
                ปิดยอดสิ้นวัน
              </Link>
              <Link href={`/dashboard/cash-closing/history${q}`} className="flex-1 text-center text-[10px] font-semibold py-2 border-l border-gray-100 text-gray-500 hover:bg-gray-50">
                ประวัติ
              </Link>
            </div>
          </div>
        </div>

        {/* แถวล่าง: บัญชีเดือนนี้ | ตารางงาน */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">

          {/* บัญชีเดือนนี้ */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-800">บัญชีเดือนนี้</span>
              {overdueShift && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">รอปิดกะ</span>
              )}
            </div>
            {accountingSummary ? (
              <div className="p-4 flex flex-col gap-3">
                <div>
                  <p className={`text-xl font-black ${accountingSummary.income - accountingSummary.expense >= 0 ? "text-gray-900" : "text-red-600"}`}>
                    {formatCurrency(accountingSummary.income - accountingSummary.expense, country)}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">สุทธิ · {accountingSummary.count} รายการ</p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">รายรับ</p>
                    <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatCurrency(accountingSummary.income, country)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">รายจ่าย</p>
                    <p className="text-sm font-bold text-red-500 mt-0.5">{formatCurrency(accountingSummary.expense, country)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-xs text-gray-400">ไม่มีสิทธิ์ดูข้อมูลนี้</div>
            )}
            <Link href={`/dashboard/accounting${q}`} className="block text-center text-[10px] font-semibold border-t border-gray-100 py-2 hover:bg-gray-50">
              ดูบัญชีทั้งหมด
            </Link>
          </div>

          {/* ตารางงาน */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-800">ตารางงาน</span>
              <div className="flex items-center gap-2">
                {todayEntries.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                    {Array.from(new Set(todayEntries.map(e => e.user_name))).length} คนวันนี้
                  </span>
                )}
                <Link href={`/dashboard/schedule${q}`} className="text-[10px] font-semibold text-gray-400 hover:text-black">ดูทั้งหมด →</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4">
              {scheduleDays.map((day, i) => (
                <div key={day.date} className={`p-3 ${i > 0 ? "border-l border-gray-100" : ""} ${i === 0 ? "bg-purple-50/40" : ""}`}>
                  <p className={`text-[10px] font-semibold mb-2 ${i === 0 ? "text-purple-700" : "text-gray-400"}`}>
                    {formatDayLabel(new Date(`${day.date}T00:00:00`), i === 0)}
                  </p>
                  {day.entries.length === 0 ? (
                    <p className="text-[10px] text-gray-300">ไม่มีตารางงาน</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {day.entries.map(e => {
                        const shift = shiftsById[e.shift_id];
                        const c = SHIFT_COLORS[shift?.color ?? "blue"] ?? SHIFT_COLORS.blue;
                        return (
                          <div key={e.id} className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-md ${c.chip}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
                            <span className="truncate flex-1">{e.user_name}</span>
                            {shift && <span className="opacity-70 flex-shrink-0">{shift.start_time}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </section>
    </main>
  );
}
