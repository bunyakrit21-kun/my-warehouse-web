"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT, LangSwitcher } from "@/lib/i18n";

interface Product { id: string; name: string; stock: number; minStock: number; unit: string; }
interface Store { id: number; name: string; business_type: string; phone: string; my_role: string; country: string | null; logo_thumbnail: string | null; }
interface User { id: number; name: string; email: string; role: string; }
interface ScheduleEntry { id: number; work_date: string; shift_id: number; user_id: number; user_name: string; }
interface FlaggedClosing { id: number; }

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

  const fetchTodayScheduleForStore = async (sid: number) => {
    const todayStr = formatDateStr(new Date());
    const data = await fetch(`/api/schedule?storeId=${sid}&weekStart=${todayStr}&days=1`).then(r => r.ok ? r.json() : null);
    if (!data) return;
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
      if (first) await Promise.all([fetchProductsForStore(first.id), fetchTodayScheduleForStore(first.id), fetchFlaggedClosingsForStore(first.id)]);
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

  const todayNames = Array.from(new Set(todayEntries.map(e => e.user_name)));

  const q = currentStore ? `?storeId=${currentStore.id}` : "";
  const qAmp = currentStore ? `&storeId=${currentStore.id}` : "";

  const navItems = [
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
      key: "closing", label: t("quickCashClosing"), href: `/dashboard/cash-closing${q}`, box: "bg-emerald-50 border-emerald-100 text-emerald-600",
      badge: flaggedClosings.length > 0 ? flaggedClosings.length : undefined,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <rect x="3" y="5" width="18" height="14" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 12l2.5 2.5L16 9" />
        </svg>
      ),
    },
    {
      key: "inventory", label: t("totalStockLabel"), href: `/dashboard/inventory${q}`, box: "bg-sky-50 border-sky-100 text-sky-600",
      badge: criticalItems.length > 0 ? criticalItems.length : undefined,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
      ),
    },
    {
      key: "schedule", label: "ตารางงาน", href: `/dashboard/schedule${q}`, box: "bg-purple-50 border-purple-100 text-purple-600",
      badge: todayNames.length > 0 ? todayNames.length : undefined,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="17" rx="2" /><path strokeLinecap="round" d="M3 9h18M8 3v3M16 3v3" /></svg>
      ),
    },
    {
      key: "reports", label: t("stockStatusLabel"), href: `/dashboard/reports${q}`, box: "bg-slate-50 border-slate-200 text-slate-600",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2zm9 0v-3a2 2 0 012-2h2a2 2 0 012 2v3a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
      ),
    },
    {
      key: "accounting", label: t("quickAccounting"), href: `/dashboard/accounting${q}`, box: "bg-indigo-50 border-indigo-100 text-indigo-600",
      tag: "กำลังพัฒนา",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m-4-4h8" /><circle cx="12" cy="12" r="9" /></svg>
      ),
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
                        onClick={() => { setCurrentStore(store); setDropdownOpen(false); fetchProductsForStore(store.id); fetchTodayScheduleForStore(store.id); fetchFlaggedClosingsForStore(store.id); }}
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

      <section className="mx-auto max-w-7xl px-6 py-6">

        {/* แถบแจ้งเตือน — โชว์เฉพาะตอนมีอะไรต้องดู */}
        {(criticalItems.length > 0 || flaggedClosings.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-5">
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

        {/* ไอคอนนำทางหลัก */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {navItems.map(item => (
            <Link key={item.key} href={item.href}
              className="relative flex flex-col items-center gap-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-black hover:shadow-md transition-all">
              {item.badge !== undefined && (
                <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center">
                  {item.badge}
                </span>
              )}
              <div className={`w-12 h-12 rounded-2xl border grid place-items-center ${item.box}`}>
                {item.icon}
              </div>
              <span className="text-xs font-semibold text-gray-700 text-center leading-tight">{item.label}</span>
              {item.tag && (
                <span className="text-[9px] font-bold text-indigo-500 -mt-1">{item.tag}</span>
              )}
            </Link>
          ))}
        </div>

      </section>
    </main>
  );
}