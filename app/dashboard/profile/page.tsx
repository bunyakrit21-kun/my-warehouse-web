"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useT, LangSwitcher } from "@/lib/i18n";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

const ROLE_COLOR: Record<string, string> = {
  admin: "bg-black text-white",
  manager: "bg-blue-600 text-white",
  staff: "bg-gray-200 text-gray-700",
};

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useT();

  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);

  // Personal info
  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          setUser(data.user);
          setName(data.user.name ?? "");
        }
      });
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setSavingProfile(true);
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSavingProfile(false);
    if (res.ok) {
      setProfileMsg({ type: "ok", text: t("profileSaved") });
      setUser(u => u ? { ...u, name } : u);
    } else {
      const d = await res.json();
      setProfileMsg({ type: "err", text: d.error ?? t("error") });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: "err", text: t("passwordMismatch") });
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg({ type: "err", text: t("passwordMinChars") });
      return;
    }
    setChangingPw(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setChangingPw(false);
    if (res.ok) {
      setPwMsg({ type: "ok", text: t("passwordChanged") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setPwMsg({ type: "err", text: data.error ?? t("error") });
    }
  };

  if (!mounted) return null;

  const ROLE_LABEL: Record<string, string> = {
    admin: t("roleAdmin"),
    manager: t("roleManager"),
    staff: t("roleStaff"),
    owner: t("roleOwner"),
  };

  const pwStrength = (() => {
    if (!newPassword) return null;
    if (newPassword.length < 6) return { label: t("pwWeak"), color: "bg-red-400", w: "w-1/4" };
    if (newPassword.length < 10) return { label: t("pwMedium"), color: "bg-yellow-400", w: "w-1/2" };
    if (/[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword)) return { label: t("pwStrong"), color: "bg-green-500", w: "w-full" };
    return { label: t("pwGood"), color: "bg-blue-400", w: "w-3/4" };
  })();

  return (
    <main className="min-h-screen bg-gray-50 font-sans antialiased pb-16">
      <header className="border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/dashboard")}
              className="grid h-9 w-9 place-items-center rounded-xl border border-gray-200 hover:border-black transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-base font-bold text-gray-900">{t("profileTitle")}</h1>
          </div>
          <LangSwitcher />
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-6 py-8 space-y-6">

        {/* Avatar + role badge */}
        <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-black text-white text-2xl font-black shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{user?.name}</p>
            <p className="text-sm text-gray-400">{user?.email}</p>
            <span className={`inline-flex mt-2 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ROLE_COLOR[user?.role ?? "staff"] ?? "bg-gray-200 text-gray-700"}`}>
              {ROLE_LABEL[user?.role ?? "staff"]}
            </span>
          </div>
        </div>

        {/* Personal info */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-800 mb-5">{t("personalInfo")}</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t("fullName")}</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t("fullNamePlaceholder")}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-black focus:bg-white transition-all"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t("email")}</label>
              <input
                type="email"
                value={user?.email ?? ""}
                disabled
                className="w-full rounded-xl border border-gray-100 bg-gray-100 px-4 py-2.5 text-sm text-gray-400 cursor-not-allowed"
              />
            </div>

            {profileMsg && (
              <p className={`text-xs font-semibold px-4 py-2.5 rounded-xl ${profileMsg.type === "ok" ? "text-green-700 bg-green-50 border border-green-100" : "text-red-600 bg-red-50 border border-red-100"}`}>
                {profileMsg.type === "ok" ? "✓ " : "✕ "}{profileMsg.text}
              </p>
            )}

            <button type="submit" disabled={savingProfile}
              className="rounded-xl bg-black text-white px-6 py-2.5 text-sm font-semibold hover:bg-gray-800 disabled:bg-gray-300 transition-all">
              {savingProfile ? t("saving") : t("saveProfile")}
            </button>
          </form>
        </div>

        {/* Change password */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-1.5 bg-amber-50 rounded-lg">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-gray-800">{t("securitySection")}</h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Current password */}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t("currentPassword")}</label>
              <div className="relative">
                <input
                  type={showCurrentPw ? "text" : "password"}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-10 text-sm outline-none focus:border-black focus:bg-white transition-all"
                  required
                />
                <button type="button" onClick={() => setShowCurrentPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCurrentPw
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t("newPassword")}</label>
              <div className="relative">
                <input
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-10 text-sm outline-none focus:border-black focus:bg-white transition-all"
                  required
                />
                <button type="button" onClick={() => setShowNewPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNewPw
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
              {/* Password strength bar */}
              {pwStrength && (
                <div className="mt-2">
                  <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pwStrength.color} ${pwStrength.w}`} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{pwStrength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t("confirmPassword")}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className={`w-full rounded-xl border bg-gray-50 px-4 py-2.5 text-sm outline-none focus:bg-white transition-all ${confirmPassword && confirmPassword !== newPassword ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-black"}`}
                required
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-[11px] text-red-500 mt-1">{t("passwordMismatch")}</p>
              )}
            </div>

            {pwMsg && (
              <p className={`text-xs font-semibold px-4 py-2.5 rounded-xl ${pwMsg.type === "ok" ? "text-green-700 bg-green-50 border border-green-100" : "text-red-600 bg-red-50 border border-red-100"}`}>
                {pwMsg.type === "ok" ? "✓ " : "✕ "}{pwMsg.text}
              </p>
            )}

            <button type="submit" disabled={changingPw || (!!confirmPassword && confirmPassword !== newPassword)}
              className="rounded-xl bg-black text-white px-6 py-2.5 text-sm font-semibold hover:bg-gray-800 disabled:bg-gray-300 transition-all">
              {changingPw ? t("changingPassword") : t("changePasswordBtn")}
            </button>
          </form>
        </div>

      </section>
    </main>
  );
}
