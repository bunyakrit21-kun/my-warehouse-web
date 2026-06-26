"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT, LangSwitcher } from "@/lib/i18n";

const BACKGROUND_IMAGES = [
  "https://images.unsplash.com/photo-1586528116311-ad8ed7c1590f?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1553413077-190dd305871c?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=2070&auto=format&fit=crop"
];

export default function LandingPage() {
  const router = useRouter();
  const { t } = useT();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % BACKGROUND_IMAGES.length);
    }, 5000); 
    return () => clearInterval(interval);
  }, []);

  const handleStartClick = () => {
    // 1. ตรวจสอบสถานะการเข้าสู่ระบบ
    // ปรับเปลี่ยนตามระบบ Auth ของคุณ (ถ้าใช้ Iron Session หรือ NextAuth จะเช็คจาก Cookie)
    const isAuthenticated = localStorage.getItem("diam_logged_in") === "true";

    if (isAuthenticated) {
      router.push("/dashboard");
    } else {
      // 2. ถ้ายังไม่ล็อกอิน ให้ไปหน้า Login ทันที
      router.push("/login");
    }
  };

  return (
    <main className="relative w-full h-screen overflow-hidden bg-black text-white selection:bg-white selection:text-black font-sans">
      
      <style>{`
        @keyframes slowPan { 0% { transform: scale(1.0); } 100% { transform: scale(1.05); } }
        .animate-slow-pan { animation: slowPan 10s ease-in-out infinite alternate; }
      `}</style>

      {BACKGROUND_IMAGES.map((imgUrl, index) => (
        <div 
          key={imgUrl}
          className={`absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-1000 ${
            index === currentImageIndex ? "opacity-40 animate-slow-pan" : "opacity-0"
          }`}
          style={{ backgroundImage: `url('${imgUrl}')` }}
        />
      ))}

      <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-8 md:px-12">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-black shadow-lg">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            </svg>
          </div>
          <span className="text-xl font-black tracking-widest uppercase">DiaM</span>
        </div>

        <div className="flex items-center gap-4">
          <LangSwitcher variant="dark" />
          <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white transition">{t("login")}</Link>
          <Link href="/signup" className="rounded-full bg-white/10 backdrop-blur-md border border-white/20 px-5 py-2.5 text-sm font-semibold hover:bg-white hover:text-black transition-all">
            {t("signup")}
          </Link>
        </div>
      </header>

      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-[10px] font-bold tracking-[0.2em] uppercase text-gray-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          {t("landingBadge")}
        </div>

        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 text-white drop-shadow-2xl whitespace-pre-line">
          {t("landingHeadline")}
        </h1>

        <p className="max-w-xl text-lg font-light text-gray-300 mb-10 leading-relaxed">
          {t("landingDesc")}
        </p>

        <button
          onClick={handleStartClick}
          className="group flex items-center gap-3 rounded-full bg-white px-10 py-4 text-sm font-bold text-black transition-transform hover:scale-105 active:scale-95"
        >
          {t("getStarted")}
          <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
        </button>
      </div>
    </main>
  );
}