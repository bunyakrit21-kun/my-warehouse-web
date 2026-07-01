"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useT, LangSwitcher } from "@/lib/i18n";

interface FreshItem {
  id: string;
  name: string;
  unit: string;
  image: string;
  parLevel: number | null;
}

interface DailyCheck {
  productId: string;
  remainingQty: number;
  wasteQty: number;
  checkedByName: string | null;
  createdAt: string;
}

interface RowState {
  remaining: string;
  waste: string;
  saved: boolean;
  saving: boolean;
  error: string;
}

function FreshCheckContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useT();

  const [items, setItems] = useState<FreshItem[]>([]);
  const [todayChecks, setTodayChecks] = useState<Record<string, DailyCheck>>({});
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  // PIN modal
  const [pinModal, setPinModal] = useState<{ productId: string } | null>(null);
  const [pin, setPin] = useState(["", "", "", ""]);
  const pinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const [pinError, setPinError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      let sid = searchParams.get("storeId");
      if (!sid) {
        const r = await fetch("/api/stores");
        if (r.ok) {
          const stores = await r.json();
          if (stores.length > 0) sid = String(stores[0].id);
        }
      }
      if (!sid) { setLoading(false); setMounted(true); return; }
      setStoreId(sid);

      const [itemsRes, checksRes] = await Promise.all([
        fetch(`/api/fresh-items?storeId=${sid}`),
        fetch(`/api/daily-checks?storeId=${sid}`),
      ]);

      const itemsData: FreshItem[] = itemsRes.ok ? await itemsRes.json() : [];
      const checksData: DailyCheck[] = checksRes.ok ? await checksRes.json() : [];

      const checkMap: Record<string, DailyCheck> = {};
      for (const c of checksData) checkMap[String(c.productId)] = c;

      const initialRows: Record<string, RowState> = {};
      for (const item of itemsData) {
        const existing = checkMap[String(item.id)];
        initialRows[item.id] = {
          remaining: existing ? String(existing.remainingQty) : "",
          waste: existing ? String(existing.wasteQty ?? 0) : "",
          saved: !!existing,
          saving: false,
          error: "",
        };
      }

      setItems(itemsData);
      setTodayChecks(checkMap);
      setRows(initialRows);
      setLoading(false);
      setMounted(true);
    }
    init();
  }, [searchParams]);

  const openPinModal = (productId: string) => {
    setPinModal({ productId });
    setPin(["", "", "", ""]);
    setPinError("");
    setTimeout(() => pinRefs[0].current?.focus(), 100);
  };

  const handlePinKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pin[i] && i > 0) pinRefs[i - 1].current?.focus();
  };
  const handlePinInput = (i: number, v: string) => {
    const digit = v.replace(/\D/g, "").slice(-1);
    const next = [...pin];
    next[i] = digit;
    setPin(next);
    if (digit && i < 3) pinRefs[i + 1].current?.focus();
  };

  const handleSave = async () => {
    if (!pinModal || !storeId) return;
    const { productId } = pinModal;
    const row = rows[productId];
    const pinStr = pin.join("");
    if (pinStr.length !== 4) { setPinError(t("alertPinRequired")); return; }
    if (!row.remaining) { setPinError(t("remainingQtyLabel") + " ต้องกรอก"); return; }

    setSubmitting(true);
    setPinError("");
    const res = await fetch("/api/daily-checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: Number(storeId),
        productId,
        remainingQty: Number(row.remaining),
        wasteQty: Number(row.waste) || 0,
        pin: pinStr,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setPinError(data.error ?? t("error")); return; }

    setRows(prev => ({ ...prev, [productId]: { ...prev[productId], saved: true, error: "" } }));
    setPinModal(null);
  };

  const allDone = items.length > 0 && items.every(it => rows[it.id]?.saved);

  if (!mounted) return null;
  if (loading) return <div className="p-8 text-center text-gray-400">{t("loading")}</div>;

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <header className="border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/dashboard")}
              className="grid h-9 w-9 place-items-center rounded-xl border border-gray-200 hover:border-black transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-gray-900">{t("freshCheckTitle")}</h1>
              <p className="text-xs text-gray-400">{new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}</p>
            </div>
          </div>
          <LangSwitcher />
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-6 space-y-4">
        {allDone && (
          <div className="rounded-2xl bg-green-50 border border-green-200 p-5 text-center">
            <div className="text-2xl mb-1">✅</div>
            <p className="text-sm font-bold text-green-800">{t("freshAllDone")}</p>
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">🥬</div>
            <p className="text-sm text-gray-500">{t("freshItemsEmpty")}</p>
          </div>
        ) : (
          items.map(item => {
            const row = rows[item.id] ?? { remaining: "", waste: "", saved: false, saving: false, error: "" };
            const existingCheck = todayChecks[String(item.id)];
            return (
              <div key={item.id} className={`rounded-2xl border bg-white p-5 transition-all ${row.saved ? "border-green-200" : "border-gray-200"}`}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt="" className="w-12 h-12 rounded-xl object-cover border border-gray-100" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-100 grid place-items-center text-2xl">🥬</div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-gray-900">{item.name}</p>
                      {item.parLevel !== null && (
                        <p className="text-xs text-gray-400">{t("colParLevel")}: {item.parLevel} {item.unit}</p>
                      )}
                    </div>
                  </div>
                  {row.saved ? (
                    <span className="shrink-0 rounded-full bg-green-100 text-green-700 text-xs font-bold px-3 py-1">{t("checkedToday")} ✓</span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-amber-50 text-amber-600 text-xs font-semibold px-3 py-1">{t("notCheckedToday")}</span>
                  )}
                </div>

                {existingCheck && row.saved && (
                  <div className="mb-3 text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
                    {t("colCheckedBy")}: {existingCheck.checkedByName ?? "–"} · {t("remainingQtyLabel")}: {existingCheck.remainingQty} {item.unit}
                    {Number(existingCheck.wasteQty) > 0 && ` · ${t("wasteQtyLabel")}: ${existingCheck.wasteQty} ${item.unit}`}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">
                      {t("remainingQtyLabel")} ({item.unit}) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={row.remaining}
                      onChange={e => setRows(prev => ({ ...prev, [item.id]: { ...prev[item.id], remaining: e.target.value } }))}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-black"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">
                      {t("wasteQtyLabel")} ({item.unit})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={row.waste}
                      onChange={e => setRows(prev => ({ ...prev, [item.id]: { ...prev[item.id], waste: e.target.value } }))}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-black"
                      placeholder="0"
                    />
                  </div>
                </div>

                <button
                  onClick={() => openPinModal(item.id)}
                  disabled={!row.remaining}
                  className="w-full rounded-xl bg-black text-white text-sm font-semibold py-2.5 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-all"
                >
                  {t("saveCheckBtn")}
                </button>
                {row.error && <p className="text-xs text-red-600 mt-1.5">{row.error}</p>}
              </div>
            );
          })
        )}
      </div>

      {/* PIN Modal */}
      {pinModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xs p-6">
            <h3 className="text-base font-bold text-center mb-1">{t("confirmPin")}</h3>
            <p className="text-xs text-gray-400 text-center mb-5">{t("pinLabel")}</p>
            <div className="flex justify-center gap-3 mb-4">
              {pin.map((d, i) => (
                <input
                  key={i}
                  ref={pinRefs[i]}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onKeyDown={e => handlePinKey(i, e)}
                  onChange={e => handlePinInput(i, e.target.value)}
                  className="w-12 h-12 rounded-xl border-2 border-gray-200 text-center text-xl font-black outline-none focus:border-black transition-all"
                />
              ))}
            </div>
            {pinError && <p className="text-xs text-red-600 text-center mb-3">{pinError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setPinModal(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                {t("cancel")}
              </button>
              <button onClick={handleSave} disabled={submitting || pin.join("").length !== 4}
                className="flex-1 rounded-xl bg-black text-white py-2.5 text-sm font-semibold hover:bg-gray-800 disabled:bg-gray-300">
                {submitting ? "..." : t("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function FreshCheckPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">กำลังโหลด...</div>}>
      <FreshCheckContent />
    </Suspense>
  );
}
