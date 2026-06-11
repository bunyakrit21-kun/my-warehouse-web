"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      // 🚀 ยิงข้อมูลไปหาโค้ดหลังบ้าน (Backend API) ที่คุณเขียนไว้
      const response = await fetch("/api/signup", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        // บันทึกสถานะลงเครื่องและเด้งไปหน้าหลักคลังสินค้าตามที่หลังบ้านสั่ง
        localStorage.setItem("diam_logged_in", "true");
        router.push("/main");
        router.refresh();
      } else {
        const text = await response.text();
        setError(text || "เกิดข้อผิดพลาดในการสมัครสมาชิก");
      }
    } catch (err) {
      setError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white font-sans">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md shadow-2xl">
        
        {/* โลโก้ & หัวข้อ */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-wider text-white mb-2">DiaM</h1>
          <p className="text-sm text-gray-400">สร้างบัญชีผู้ใช้ระบบจัดการคลังสินค้า</p>
        </div>

        {/* แสดงข้อความแจ้งเตือนข้อผิดพลาด */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
            ⚠️ {error}
          </div>
        )}

        {/* ฟอร์มกรอกข้อมูล */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-mono tracking-widest text-gray-400 mb-2 uppercase">Full Name</label>
            <input 
              type="text" 
              name="name" 
              required 
              placeholder="กรุณากรอกชื่อ-นามสกุล"
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-mono tracking-widest text-gray-400 mb-2 uppercase">Email Address</label>
            <input 
              type="email" 
              name="email" 
              required 
              placeholder="example@diam.com"
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-mono tracking-widest text-gray-400 mb-2 uppercase">Password</label>
            <input 
              type="password" 
              name="password" 
              required 
              placeholder="••••••••"
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none transition-all"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black hover:bg-gray-200 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] disabled:bg-gray-500"
          >
            {loading ? "กำลังประมวลผล..." : "ยืนยันการสมัครสมาชิก"}
          </button>
        </form>

        {/* ลิงก์ย้อนกลับ */}
        <div className="mt-6 text-center text-sm text-gray-400">
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/login" className="text-white hover:underline font-medium">
            เข้าสู่ระบบ
          </Link>
        </div>

      </div>
    </main>
  );
}
