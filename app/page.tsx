"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// 1. เตรียมรูปภาพพื้นหลัง 3-4 รูป
const BACKGROUND_IMAGES = [
  "https://images.unsplash.com/photo-1586528116311-ad8ed7c1590f?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1553413077-190dd305871c?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=2070&auto=format&fit=crop"
];

export default function LandingPage() {
  const router = useRouter();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // 2. ระบบรันภาพพื้นหลังอัตโนมัติ (แก้ไขจาก 000 เป็น 5000 เพื่อแก้ปัญหา Build Error)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % BACKGROUND_IMAGES.length);
    }, 5000); 
    
    return () => clearInterval(interval);
  }, []);

  // 3. ฟังก์ชันเช็คการเข้าสู่ระบบก่อนกดเริ่มใช้งาน
  const handleStartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const isLoggedIn = localStorage.getItem("diam_logged_in") === "true";

    if (isLoggedIn) {
      router.push("/main");
    } else {
      alert("🔒 กรุณาเข้าสู่ระบบก่อนเริ่มใช้งานครับ");
      router.push("/login");
    }
  };

  return (
    <main className="relative w-full h-screen overflow-hidden bg-black text-white selection:bg-white selection:text-black font-sans">
      
      {/* --- ส่วนพื้นหลังสไลด์โชว์ --- */}
      {BACKGROUND_IMAGES.map((imgUrl, index) => (
        <div 
          key={imgUrl}
          className={`absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-1000 ease-in-out ${
            index === currentImageIndex ? "opacity-40 animate-slow-pan" : "opacity-0"
          }`}
          style={{ backgroundImage: `url('${imgUrl}')` }}
        />
      ))}

      {/* สไตล์แอนิเมชันขยับภาพ */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slowPan {
          0% { transform: scale(1.0); background-position: center; }
          100% { transform: scale(1.1); background-position: center; }
        }
        .animate-slow-pan {
          animation: slowPan 10s linear infinite alternate;
        }
      `}} />

      {/* --- แถบนำทางด้านบนแบบใส --- */}
      <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-6 md:px-12 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-black">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <span className="text-2xl font-bold tracking-widest text-white">DiaM</span>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <Link href="/login" className="text-sm font-medium text-gray-200 hover:text-white transition">
            เข้าสู่ระบบ
          </Link>
          
          <Link href="/signup" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-gray-200 hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] inline-block text-center"> 
            สมัครใช้งาน
          </Link>
        </div>
      </header>

      {/* --- ส่วนข้อความตรงกลาง (Hero Content) --- */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full px-6 text-center">
        
        <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-xs font-mono tracking-widest text-gray-200">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          SMART SUPPLY CHAIN
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-6 drop-shadow-lg transition-all duration-700">
          Control Your <br className="md:hidden" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-500">
            Inventory.
          </span>
        </h1>
        
        <p className="max-w-2xl text-lg md:text-xl font-light text-gray-300 mb-10 drop-shadow-md leading-relaxed">
          แพลตฟอร์มบริหารจัดการสต็อกและคลังสินค้าอัจฉริยะ 
          <br className="hidden md:block" /> มั่นใจด้วยระบบ Data Integrity เชื่อมต่อข้อมูลเรียลไทม์
        </p>

        <button 
          onClick={handleStartClick}
          className="group flex items-center gap-3 rounded-full bg-white px-8 py-4 text-base font-semibold text-black transition-all hover:scale-105 hover:bg-gray-100 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
        >
          เริ่มต้นใช้งาน
          <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
          </svg>
        </button>
        
        <p className="mt-5 text-xs text-gray-400 font-mono tracking-wide">
          ไม่มีค่าใช้จ่ายแอบแฝง • ไม่ต้องใช้บัตรเครดิต
        </p>
      </div>
    </main>
  );
}