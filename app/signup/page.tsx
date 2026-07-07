"use client";

import { useState } from "react";
import Link from "next/link";
import { useT, LangSwitcher, type LangCode } from "@/lib/i18n";
import { COUNTRIES, DEFAULT_COUNTRY_CODE } from "@/lib/countries";
import PasswordInput from "@/components/PasswordInput";

const BIZ_KEYS = [
  "bizRestaurant",
  "bizCafe",
  "bizRetail",
  "bizConstruction",
  "bizHotel",
  "bizSpa",
  "bizOther",
] as const;

const LANGUAGES: { code: LangCode; label: string }[] = [
  { code: "th", label: "ไทย" },
  { code: "en", label: "English" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "vi", label: "Tiếng Việt" },
];

function suggestLangForCountry(countryCode: string): LangCode {
  if (countryCode === "TH") return "th";
  if (countryCode === "VN") return "vi";
  if (countryCode === "TW" || countryCode === "HK") return "zh-TW";
  return "en";
}

type PasswordStrength = "weak" | "medium" | "strong";

function getPasswordStrength(pw: string): PasswordStrength {
  if (pw.length < 8) return "weak";
  let classes = 0;
  if (/[a-z]/.test(pw)) classes++;
  if (/[A-Z]/.test(pw)) classes++;
  if (/\d/.test(pw)) classes++;
  if (/[^a-zA-Z0-9]/.test(pw)) classes++;
  if (pw.length >= 12 && classes >= 3) return "strong";
  if (pw.length >= 10 && classes >= 2) return "medium";
  return "weak";
}

const STRENGTH_COLOR: Record<PasswordStrength, string> = {
  weak: "bg-red-400",
  medium: "bg-amber-400",
  strong: "bg-emerald-500",
};

const STRENGTH_WIDTH: Record<PasswordStrength, string> = {
  weak: "w-1/3",
  medium: "w-2/3",
  strong: "w-full",
};

export default function SignupPage() {
  const { t } = useT();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [done, setDone] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [storeName, setStoreName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [customBusinessType, setCustomBusinessType] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE);
  const [language, setLanguage] = useState<LangCode>(suggestLangForCountry(DEFAULT_COUNTRY_CODE));
  const [languageTouched, setLanguageTouched] = useState(false);
  const [businessDayStartTime, setBusinessDayStartTime] = useState("00:00");
  const [businessDayEndTime, setBusinessDayEndTime] = useState("00:00");

  const [termsAccepted, setTermsAccepted] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedCountry = COUNTRIES.find(c => c.code === country) ?? COUNTRIES[0];
  const strength = getPasswordStrength(password);

  const handleCountryChange = (code: string) => {
    setCountry(code);
    if (!languageTouched) setLanguage(suggestLangForCountry(code));
  };

  const goNextFromStep1 = () => {
    setError("");
    if (!name || !email || !password) {
      return setError(t("fillAllFields"));
    }
    if (password.length < 8 || !/\d/.test(password)) {
      return setError(t("passwordMinCharsStrong"));
    }
    if (password !== confirmPassword) {
      return setError(t("passwordMismatch"));
    }
    setStep(2);
  };

  const goNextFromStep2 = () => {
    setError("");
    const finalBusinessType = businessType === t("bizOther") ? customBusinessType : businessType;
    if (!storeName || !finalBusinessType || !phone) {
      return setError(t("fillAllFields"));
    }
    setStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    if (!termsAccepted) {
      return setError(t("termsRequired"));
    }

    setLoading(true);

    const finalBusinessType = businessType === t("bizOther") ? customBusinessType : businessType;

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, email, password, storeName, businessType: finalBusinessType, phone,
        country, language, businessDayStartTime, businessDayEndTime,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      return setError(data.error);
    }

    setDone(true);
  };

  if (done) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-lg font-bold text-gray-900 mb-1">{t("signupDoneTitle")}</p>
            <p className="text-sm text-gray-500 mb-6">{t("signupDoneMessage")}</p>
            <Link href="/login"
              className="inline-block w-full rounded-xl bg-black text-white py-3 text-sm font-semibold hover:bg-gray-800 transition-all">
              {t("goToLoginBtn")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

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

        <div className="flex items-center justify-center gap-2 mb-5">
          {[1, 2, 3].map(n => (
            <div key={n} className={`h-1.5 rounded-full transition-all ${n === step ? "w-8 bg-black" : n < step ? "w-8 bg-gray-400" : "w-8 bg-gray-200"}`} />
          ))}
        </div>
        <p className="text-center text-[11px] font-semibold text-gray-400 mb-4">
          {t("stepIndicatorLabel")} {step} {t("stepOf")}
        </p>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {step === 1 && (
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
                    <PasswordInput value={password} onChange={setPassword} placeholder={t("passwordMinCharsStrong")} autoComplete="new-password" required />
                    {password && (
                      <div className="mt-1.5">
                        <div className="h-1 w-full rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${STRENGTH_COLOR[strength]} ${STRENGTH_WIDTH[strength]}`} />
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {t("passwordStrengthLabel")}: {t(`passwordStrength${strength[0].toUpperCase()}${strength.slice(1)}` as "passwordStrengthWeak")}
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">{t("confirmPassword")}</label>
                    <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder={t("confirmPasswordPlaceholder")} autoComplete="new-password" required />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
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
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">{t("storeCountryLabel")}</label>
                    <select value={country} onChange={e => handleCountryChange(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm tracking-normal outline-none focus:border-black focus:bg-white transition-all" required>
                      {COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      {t("storeCountryTzHint")} {selectedCountry.timezone} ({selectedCountry.utcOffset})
                      <br />
                      {t("storeCountryCurrencyHint")} {selectedCountry.currencyCode} ({selectedCountry.currencySymbol})
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">
                      {t("storeLanguageLabel")} <span className="font-normal text-gray-400">{t("storeLanguageHint")}</span>
                    </label>
                    <select value={language} onChange={e => { setLanguage(e.target.value as LangCode); setLanguageTouched(true); }}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm tracking-normal outline-none focus:border-black focus:bg-white transition-all">
                      {LANGUAGES.map(l => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">{t("businessHoursLabel")}</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">{t("businessDayStart")}</label>
                        <input type="time" value={businessDayStartTime} onChange={e => setBusinessDayStartTime(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm tracking-normal outline-none focus:border-black focus:bg-white transition-all" />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">{t("businessDayEnd")}</label>
                        <input type="time" value={businessDayEndTime} onChange={e => setBusinessDayEndTime(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm tracking-normal outline-none focus:border-black focus:bg-white transition-all" />
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5">{t("businessHoursHelp")}</p>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{t("confirmStepTitle")}</p>
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-1.5">
                    <p><span className="text-gray-400">{t("fullName")}:</span> {name}</p>
                    <p><span className="text-gray-400">{t("email")}:</span> {email}</p>
                    <p><span className="text-gray-400">{t("storeNameShort")}:</span> {storeName}</p>
                    <p><span className="text-gray-400">{t("storeCountryLabel")}:</span> {selectedCountry.label}</p>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-gray-300 accent-black" />
                    <span className="text-xs font-semibold text-gray-600">{t("termsAgree")}</span>
                  </label>
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>
            )}

            <div className="flex gap-3">
              {step > 1 && (
                <button type="button" onClick={() => { setStep((step - 1) as 1 | 2); setError(""); }}
                  className="flex-1 rounded-xl bg-gray-100 text-gray-600 py-3 text-sm font-semibold hover:bg-gray-200 transition-all">
                  {t("back")}
                </button>
              )}
              {step < 3 ? (
                <button type="button" onClick={step === 1 ? goNextFromStep1 : goNextFromStep2}
                  className="flex-1 rounded-xl bg-black text-white py-3 text-sm font-semibold hover:bg-gray-800 transition-all">
                  {t("stepNext")}
                </button>
              ) : (
                <button type="submit" disabled={loading}
                  className="flex-1 rounded-xl bg-black text-white py-3 text-sm font-semibold hover:bg-gray-800 disabled:bg-gray-300 transition-all">
                  {loading ? t("creatingAccount") : t("createAccount")}
                </button>
              )}
            </div>
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
