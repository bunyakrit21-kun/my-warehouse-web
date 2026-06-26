"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import th from "./locales/th";
import en from "./locales/en";
import zhTW from "./locales/zh-TW";
import vi from "./locales/vi";
import type { LocaleKeys } from "./locales/th";

export type LangCode = "th" | "en" | "zh-TW" | "vi";

const locales: Record<LangCode, Record<LocaleKeys, string>> = { th, en, "zh-TW": zhTW, vi };

const LANG_FLAGS: Record<LangCode, string> = {
  th: "🇹🇭",
  en: "🇬🇧",
  "zh-TW": "🇹🇼",
  vi: "🇻🇳",
};

type I18nContext = {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: LocaleKeys) => string;
};

const Ctx = createContext<I18nContext>({
  lang: "th",
  setLang: () => {},
  t: (k) => th[k],
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("th");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("diam_lang") as LangCode | null;
    if (saved && locales[saved]) setLangState(saved);
    setReady(true);
  }, []);

  const setLang = (l: LangCode) => {
    setLangState(l);
    localStorage.setItem("diam_lang", l);
  };

  const t = (key: LocaleKeys): string => locales[lang][key] ?? th[key];

  if (!ready) return <>{children}</>;

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useT() {
  return useContext(Ctx);
}

// Standalone switcher — drop into any header
export function LangSwitcher({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { lang, setLang } = useT();
  const [open, setOpen] = useState(false);

  const langs: LangCode[] = ["th", "en", "zh-TW", "vi"];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
          variant === "dark"
            ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
            : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
        }`}
      >
        <span className="text-sm">{LANG_FLAGS[lang]}</span>
        <span>{locales[lang].langName}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl border border-gray-200 bg-white shadow-lg z-50 overflow-hidden">
            {langs.map((l) => (
              <button
                key={l}
                onClick={() => { setLang(l); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold transition-all hover:bg-gray-50 ${
                  lang === l ? "bg-black text-white hover:bg-black" : "text-gray-700"
                }`}
              >
                <span className="text-sm">{LANG_FLAGS[l]}</span>
                {locales[l].langName}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
