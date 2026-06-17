"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
      <div className="w-full max-w-sm">
        
        <div className="text-center mb-8">
          <p className="text-2xl font-bold tracking-tight">DiaM</p>
          <p className="text-sm text-gray-500 mt-1">เข้าสู่ระบบคลังสินค้า</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div>
              <label className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
                Email
              </label>
              <input
                type="email"
                placeholder="admin@diam.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-black focus:bg-white transition-all"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-black focus:bg-white transition-all"
                required
              />
            </div>

            {error && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                ❌ {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-black text-white py-3 text-sm font-semibold hover:bg-gray-800 disabled:bg-gray-300 transition-all mt-2"
            >
              {loading ? "กำลังตรวจสอบ..." : "ตรวจสอบสิทธิ์และเข้าสู่ระบบ"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          ยังไม่มีบัญชี?{" "}
          <Link href="/signup" className="font-semibold text-black hover:underline">
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </main>
  );
}