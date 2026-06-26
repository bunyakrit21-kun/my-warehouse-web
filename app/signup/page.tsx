"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT, LangSwitcher } from "@/lib/i18n";

const BIZ_KEYS = [
  "bizRestaurant",
  "bizCafe",
  "bizRetail",
  "bizConstruction",
  "bizHotel",
  "bizSpa",
  "bizOther",
] as const;

export default function SignupPage() {
  const router = useRouter();
  const { t } = useT();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [customBusinessType, setCustomBusinessType] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const finalBusinessType = businessType === t("bizOther") ? customBusinessType : businessType;

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, storeName, businessType: finalBusinessType, phone }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) return setError(data.error);
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8 relative">
          <div className="absolute right-0 top-0">
            <LangSwitcher />
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-black text-white font-black text-lg mx-auto mb-3">D</div>
          <p className="text-xl font-bold tracking-tight">DiaM</p>
          <p className="text-xs text-gray-400 mt-1">{t("signupTagline")}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{t("ownerInfo")}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{t("fullName")}</label>
                  <input type="text" placeholder={t("fullNamePlaceholder")} value={name} onChange={e => setName(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm tracking-normal outline-none focus:border-black focus:bg-white transition-all" required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{t("email")}</label>
                  <input type="email" placeholder={t("emailPlaceholder")} value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm tracking-normal outline-none focus:border-black focus:bg-white transition-all" required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{t("password")}</label>
                  <input type="password" placeholder={t("passwordMinChars")} value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm tracking-normal outline-none focus:border-black focus:bg-white transition-all" required />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{t("storeInfo")}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{t("storeNameShort")}</label>
                  <input type="text" placeholder={t("storeNameShortPlaceholder")} value={storeName} onChange={e => setStoreName(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm tracking-normal outline-none focus:border-black focus:bg-white transition-all" required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{t("businessType")}</label>
                  <select value={businessType} onChange={e => setBusinessType(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm tracking-normal outline-none focus:border-black focus:bg-white transition-all" required>
                    <option value="">{t("businessTypePlaceholder")}</option>
                    {BIZ_KEYS.map(key => (
                      <option key={key} value={t(key)}>{t(key)}</option>
                    ))}
                  </select>
                </div>
                {businessType === t("bizOther") && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">{t("businessTypeCustomLabel")}</label>
                    <input type="text" placeholder={t("businessTypeCustomPlaceholder")} value={customBusinessType} onChange={e => setCustomBusinessType(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm tracking-normal outline-none focus:border-black focus:bg-white transition-all" required />
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{t("phone")}</label>
                  <input type="tel" placeholder={t("phonePlaceholder")} value={phone} onChange={e => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm tracking-normal outline-none focus:border-black focus:bg-white transition-all" required />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-black text-white py-3 text-sm font-semibold hover:bg-gray-800 disabled:bg-gray-300 transition-all">
              {loading ? t("creatingAccount") : t("createAccount")}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          {t("hasAccount")}{" "}
          <Link href="/login" className="font-semibold text-black hover:underline">{t("login")}</Link>
        </p>
      </div>
    </main>
  );
}
