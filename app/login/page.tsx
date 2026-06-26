"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT, LangSwitcher } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useT();
  const [mode, setMode] = useState<"admin" | "staff">("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    router.push("/dashboard");
  };

  const handleStaffLogin = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/auth/login-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeName, pin }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    router.push("/dashboard/movement");
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-black transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 19l-7-7 7-7" />
            </svg>
            {t("backToHome")}
          </Link>
          <LangSwitcher />
        </div>

        <div className="text-center mb-8">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-black text-white font-black text-lg mx-auto mb-3">D</div>
          <p className="text-xl font-bold tracking-tight">DiaM</p>
          <p className="text-xs text-gray-400 mt-1">{t("loginTagline")}</p>
        </div>

        <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-2xl mb-6">
          <button onClick={() => { setMode("admin"); setError(""); }}
            className={"py-2.5 text-sm font-bold rounded-xl transition-all " + (mode === "admin" ? "bg-white text-black shadow-sm" : "text-gray-400 hover:text-gray-600")}>
            {t("ownerAdmin")}
          </button>
          <button onClick={() => { setMode("staff"); setError(""); }}
            className={"py-2.5 text-sm font-bold rounded-xl transition-all " + (mode === "staff" ? "bg-white text-black shadow-sm" : "text-gray-400 hover:text-gray-600")}>
            {t("staff")}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {mode === "admin" ? (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">{t("email")}</label>
                <input type="email" placeholder={t("emailPlaceholder")} value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm tracking-normal outline-none focus:border-black focus:bg-white transition-all" required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">{t("password")}</label>
                <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm tracking-normal outline-none focus:border-black focus:bg-white transition-all" required />
              </div>
              {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full rounded-xl bg-black text-white py-3 text-sm font-semibold hover:bg-gray-800 disabled:bg-gray-300 transition-all">
                {loading ? t("loggingIn") : t("login")}
              </button>
            </form>
          ) : (
            <form onSubmit={handleStaffLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">{t("storeName")}</label>
                <input type="text" placeholder={t("storeNamePlaceholder")} value={storeName} onChange={e => setStoreName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm tracking-normal outline-none focus:border-black focus:bg-white transition-all" required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">{t("pin4")}</label>
                <input type="password" inputMode="numeric" maxLength={4} placeholder="••••" value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-center font-black tracking-widest outline-none focus:border-black focus:bg-white transition-all" required />
              </div>
              {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>}
              <button type="submit" disabled={loading || pin.length !== 4}
                className="w-full rounded-xl bg-black text-white py-3 text-sm font-semibold hover:bg-gray-800 disabled:bg-gray-300 transition-all">
                {loading ? t("loggingIn") : t("login")}
              </button>
            </form>
          )}
        </div>

        {mode === "admin" && (
          <p className="text-center text-xs text-gray-400 mt-4">
            {t("noAccount")}{" "}
            <Link href="/signup" className="font-semibold text-black hover:underline">{t("signup")}</Link>
          </p>
        )}
      </div>
    </main>
  );
}
