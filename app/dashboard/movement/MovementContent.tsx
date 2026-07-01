"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useT, LangSwitcher } from "@/lib/i18n";

interface Product {
  id: string;
  name: string;
  category: string;
  zone: string;
  stock: number;
  minStock: number;
  unit: string;
  image: string;
  createdAt: string;
}

interface Movement {
  id: string;
  time: string;
  type: string;
  itemName: string;
  qty: number;
  unit: string;
  note: string;
  user: string;
}

interface CashWithdrawal {
  id: string;
  time: string;
  amount: number;
  reason: string;
  user: string;
}

interface RawMovement {
  id: number;
  created_at: string;
  type: string;
  qty: number;
  note: string | null;
  employee_pin: string | null;
  product_name: string | null;
  unit: string | null;
  employee_name: string | null;
  itemName?: string;
  user?: string;
}

interface RawCashWithdrawal {
  id: number;
  amount: number;
  reason: string;
  employee_pin: string | null;
  created_at: string;
  employee_name: string | null;
}

const QUICK_NOTES = ["เติมสต็อกของ", "เบิกไปใช้ครัว", "ของชำรุด"];
const QUICK_CASH_REASONS = ["ซื้อวัตถุดิบ", "ค่าขนส่ง", "ค่าใช้จ่ายเบ็ดเตล็ด"];

export default function MovementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useT();

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [cashWithdrawals, setCashWithdrawals] = useState<CashWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [type, setType] = useState("MOVE_IN");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [qty, setQty] = useState<number | "">(1);
  const [note, setNote] = useState("");

  // Cash withdrawal fields
  const [cashAmount, setCashAmount] = useState<number | "">("");
  const [cashReason, setCashReason] = useState("");

  const [pin, setPin] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [storeId, setStoreId] = useState("");

  const fetchData = useCallback(async () => {
    const paramProductId = searchParams.get("productId");
    const paramType = searchParams.get("type");
    const paramStoreId = searchParams.get("storeId");
    if (paramType === "MOVE_IN" || paramType === "MOVE_OUT") setType(paramType);

    try {
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      const meData = await meRes.json();
      const user = meData?.user;
      if (!user) { router.push("/login"); return; }

      const isUserStaff = user.type === "staff";
      const resolvedStoreId = isUserStaff ? String(user.storeId) : (paramStoreId ?? "");
      setIsStaff(isUserStaff);
      setStoreId(resolvedStoreId);

      if (!resolvedStoreId) { setLoading(false); return; }

      const [resP, resM, resC] = await Promise.all([
        fetch(`/api/products?storeId=${resolvedStoreId}`, { cache: "no-store" }),
        fetch(`/api/movements?storeId=${resolvedStoreId}`, { cache: "no-store" }),
        fetch(`/api/cash-withdrawals?storeId=${resolvedStoreId}`, { cache: "no-store" }),
      ]);

      const productsData: Product[] = await resP.json();
      const movementsRaw = await resM.json();
      const cashRaw = await resC.json();

      setProducts(productsData);

      const formatted: Movement[] = movementsRaw.map((m: RawMovement) => ({
        id: `MV-${String(m.id).padStart(4, "0")}`,
        time: new Date(m.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
        type: m.type,
        itemName: m.product_name ?? m.itemName ?? "-",
        qty: m.qty,
        unit: m.unit ?? "",
        note: m.note ?? "-",
        user: m.employee_name ?? m.employee_pin ?? m.user ?? "-",
      }));
      setMovements(formatted);

      const formattedCash: CashWithdrawal[] = (cashRaw ?? []).map((c: RawCashWithdrawal) => ({
        id: `CW-${String(c.id).padStart(4, "0")}`,
        time: new Date(c.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
        amount: c.amount,
        reason: c.reason,
        user: c.employee_name ?? c.employee_pin ?? "-",
      }));
      setCashWithdrawals(formattedCash);

      if (paramProductId && productsData.some((p) => p.id === paramProductId)) {
        setSelectedProductId(paramProductId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetchData().then(() => setMounted(true));
  }, [fetchData]);

  const currentProduct = products.find((p) => p.id === selectedProductId);
  const isOverStocked = type === "MOVE_OUT" && currentProduct && Number(qty) > currentProduct.stock;
  const isCashMode = type === "CASH_OUT";

  const pinInputRefs = useRef<Array<HTMLInputElement | null>>([null, null, null, null]);

  const verifyPin = async (pinToVerify: string) => {
    setVerifyingPin(true);
    try {
      const res = await fetch("/api/employees/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinToVerify, storeId }),
      });
      const data = await res.json();
      setEmployeeName(res.ok ? data.name : t("pinNotFound"));
    } catch {
      setEmployeeName(t("pinError"));
    } finally {
      setVerifyingPin(false);
    }
  };

  const handlePinBoxChange = (index: number, rawValue: string) => {
    const digit = rawValue.replace(/\D/g, "").slice(-1);
    if (!digit) return;

    let newPin: string;
    if (index > pin.length) {
      pinInputRefs.current[pin.length]?.focus();
      return;
    } else if (index === pin.length) {
      newPin = pin + digit;
    } else {
      newPin = pin.slice(0, index) + digit + pin.slice(index + 1);
    }

    setPin(newPin);
    setEmployeeName("");
    if (index < 3) pinInputRefs.current[index + 1]?.focus();
    if (newPin.length === 4) verifyPin(newPin);
  };

  const handlePinBoxKeyDown = (_index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (pin.length === 0) return;
      const newPin = pin.slice(0, -1);
      setPin(newPin);
      setEmployeeName("");
      pinInputRefs.current[newPin.length]?.focus();
    }
  };

  const handlePinPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pasted) return;
    setPin(pasted);
    setEmployeeName("");
    pinInputRefs.current[Math.min(pasted.length, 3)]?.focus();
    if (pasted.length === 4) verifyPin(pasted);
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (pin.length !== 4 || employeeName.includes("❌") || !employeeName) {
      return alert(t("alertPinRequired"));
    }

    if (isCashMode) {
      if (!cashAmount || Number(cashAmount) <= 0) return alert(t("alertAmountRequired"));
      if (!cashReason.trim()) return alert(t("alertReasonRequired"));

      setSubmitting(true);
      try {
        const res = await fetch("/api/cash-withdrawals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: Number(cashAmount),
            reason: cashReason.trim(),
            pin,
            storeId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("error"));

        alert(t("alertCashSavedOk"));
        router.push("/dashboard");
      } catch (err) {
        const msg = err instanceof Error ? err.message : t("error");
        alert(`❌ ${t("saveFailed")}: ${msg}`);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!selectedProductId || !currentProduct) return alert(t("alertSelectProduct"));
    if (!qty || Number(qty) <= 0) return alert(t("alertQtyRequired"));
    if (isOverStocked) return alert(t("alertOverStock"));

    setSubmitting(true);
    try {
      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          type,
          qty: Number(qty),
          note: note.trim() || "",
          pin,
          storeId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("error"));

      alert(t("alertSavedOk"));
      router.push("/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("error");
      alert(`❌ ${t("saveFailed")}: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted || loading) {
    return <div className="p-8 text-center text-sm font-sans text-gray-400">{t("loadingDb")}</div>;
  }

  const canSubmit = isCashMode
    ? !!cashAmount && Number(cashAmount) > 0 && !!cashReason.trim() && pin.length === 4 && !!employeeName && !employeeName.includes("❌")
    : !!selectedProductId && pin.length === 4 && !!employeeName && !employeeName.includes("❌") && !isOverStocked;

  return (
    <main className="min-h-screen bg-gray-50 text-black font-sans antialiased pb-12">

      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-gray-300 bg-gray-50">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-gray-700" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M7 7h10M7 12h10M7 17h6M4 4h16v16H4z" />
              </svg>
            </div>
            <div className="leading-tight">
              <p className="text-lg font-bold tracking-tight">DiaM</p>
              <p className="text-xs text-gray-500">Smart Inventory System</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LangSwitcher />
            {!isStaff && (
              <Link href="/dashboard" className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:border-black transition-all">
                {t("backToHome")}
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{t("movementTitle")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("movementDesc")}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">

          <div className={`md:col-span-2 rounded-2xl border bg-white p-6 shadow-sm transition-all duration-300 ${
            type === "MOVE_IN" ? "border-green-400" : type === "MOVE_OUT" ? "border-red-400" : "border-orange-400"
          }`}>
            <h2 className="text-base font-bold text-gray-800 mb-5">{t("newRecord")}</h2>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Type */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-2">{t("transactionType")}</label>
                <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1 rounded-xl">
                  <button type="button" onClick={() => { setType("MOVE_IN"); setQty(1); }}
                    className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${type === "MOVE_IN" ? "bg-green-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>
                    {t("moveIn")}
                  </button>
                  <button type="button" onClick={() => { setType("MOVE_OUT"); setQty(1); }}
                    className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${type === "MOVE_OUT" ? "bg-red-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>
                    {t("moveOut")}
                  </button>
                  <button type="button" onClick={() => setType("CASH_OUT")}
                    className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${type === "CASH_OUT" ? "bg-orange-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>
                    {t("cashOut")}
                  </button>
                </div>
              </div>

              {isCashMode ? (
                <>
                  {/* จำนวนเงิน */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">{t("cashAmountLabel")}</label>
                    <input
                      type="number" min="1" placeholder={t("cashAmountPlaceholder")} value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm font-bold outline-none focus:border-black focus:bg-white transition-all"
                      required
                    />
                  </div>

                  {/* เหตุผล + Quick reasons */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">{t("cashReasonLabel")}</label>
                    <div className="flex gap-2 mb-2 flex-wrap">
                      {QUICK_CASH_REASONS.map((q) => (
                        <button key={q} type="button" onClick={() => setCashReason(q)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${cashReason === q ? "bg-black text-white border-black" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                          {q}
                        </button>
                      ))}
                    </div>
                    <textarea rows={2} placeholder={t("cashReasonPlaceholder")} value={cashReason} onChange={(e) => setCashReason(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all resize-none" />
                  </div>

                </>
              ) : (
                <>
                  {/* Product */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-semibold text-gray-500">{t("selectProductLabel")}</label>
                      {currentProduct && (
                        <span className="text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-md">
                          {t("currentStock")}: <span className="text-black font-black">{currentProduct.stock}</span> {currentProduct.unit}
                        </span>
                      )}
                    </div>
                    <select
                      value={selectedProductId}
                      onChange={(e) => { setSelectedProductId(e.target.value); setQty(1); }}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm font-semibold outline-none focus:border-black focus:bg-white transition-all"
                      required
                    >
                      <option value="">{t("selectProductPlaceholder")}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                      ))}
                    </select>
                  </div>

                  {/* Qty */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-2">{t("qtyUnitLabel")}</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button key={num} type="button" onClick={() => setQty(num)}
                            className={`w-11 h-10 rounded-lg text-sm font-bold transition-all ${Number(qty) === num ? "bg-black text-white shadow-sm" : "text-gray-500 hover:text-black"}`}>
                            {num}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-1 items-center gap-3">
                        <input
                          type="number" min="1" placeholder={t("qtyPlaceholder")} value={qty}
                          onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
                          className={`w-full rounded-xl border py-2.5 px-4 text-sm text-center font-bold outline-none transition-all ${isOverStocked ? "border-red-500 bg-red-50 text-red-900" : "border-gray-200 bg-gray-50 focus:border-black focus:bg-white"}`}
                          required
                        />
                        <span className="text-sm font-bold text-gray-500 min-w-[80px] bg-gray-100 border border-gray-200 rounded-xl py-2.5 text-center">
                          {currentProduct ? currentProduct.unit : t("unitFallback")}
                        </span>
                      </div>
                    </div>
                    {isOverStocked && (
                      <p className="text-xs font-semibold text-red-600 mt-2">
                        {t("overStockWarning")} {currentProduct.stock} {currentProduct.unit})
                      </p>
                    )}
                  </div>

                  {/* Note + Quick Notes */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">{t("noteLabel")}</label>
                    <div className="flex gap-2 mb-2">
                      {QUICK_NOTES.map((q) => (
                        <button key={q} type="button" onClick={() => setNote(q)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${note === q ? "bg-black text-white border-black" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                          {q}
                        </button>
                      ))}
                    </div>
                    <textarea rows={2} placeholder={t("notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all resize-none" />
                  </div>

                </>
              )}

              {/* PIN */}
              <div className="pt-3 border-t border-gray-100">
                <label className="text-xs font-bold text-gray-700 block mb-2">{t("pinLabel")}</label>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex gap-3">
                    {[0, 1, 2, 3].map((i) => (
                      <input
                        key={i}
                        ref={(el) => { pinInputRefs.current[i] = el; }}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        value={pin[i] ?? ""}
                        onChange={(e) => handlePinBoxChange(i, e.target.value)}
                        onKeyDown={(e) => handlePinBoxKeyDown(i, e)}
                        onClick={() => pinInputRefs.current[Math.min(pin.length, 3)]?.focus()}
                        onPaste={handlePinPaste}
                        className={`w-12 h-12 rounded-xl border text-center text-xl font-black outline-none transition-all
                          ${pin[i] !== undefined ? "border-gray-900 bg-white" : "border-gray-200 bg-gray-50"}
                          focus:border-black focus:bg-white focus:ring-2 focus:ring-black/10`}
                      />
                    ))}
                  </div>
                  {verifyingPin && <span className="text-xs text-gray-400">{t("verifying")}</span>}
                  {!verifyingPin && employeeName && (
                    <span className={`text-xs font-bold px-3 py-2 rounded-xl border ${employeeName.includes("❌") ? "bg-red-50 text-red-600 border-red-100" : "bg-green-50 text-green-700 border-green-100"}`}>
                      {employeeName}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!canSubmit || submitting || verifyingPin}
                className={`w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed shadow-sm ${
                  type === "MOVE_IN" ? "bg-green-600 hover:bg-green-700" : type === "MOVE_OUT" ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"
                }`}
              >
                {submitting ? t("saving") : isCashMode ? t("submitCash") : type === "MOVE_IN" ? t("submitMoveIn") : t("submitMoveOut")}
              </button>
            </form>
          </div>

          {/* Sidebar */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 flex flex-col justify-between shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3">{t("sidebarTitle")}</h3>
              <ul className="space-y-3 text-xs text-gray-500 list-none leading-relaxed">
                <li>• {t("sidebarTip1")}</li>
                <li>• {t("sidebarTip2")}</li>
                <li>• {t("sidebarTip3")}</li>
                <li>• {t("sidebarTip4")}</li>
              </ul>
            </div>
            <div className="text-[10px] font-mono text-gray-400 mt-6 border-t border-gray-100 pt-3">SECURITY STATE: PIN REQUIRED</div>
          </div>
        </div>

        {/* ตารางประวัติสินค้า */}
        <div className="mt-10">
          <h2 className="text-xl font-bold tracking-tight mb-4">{t("historyTitle")}</h2>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/70 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    <th className="px-6 py-4">{t("colLogId")}</th>
                    <th className="px-6 py-4">{t("colTime")}</th>
                    <th className="px-6 py-4">{t("colType")}</th>
                    <th className="px-6 py-4">{t("colProduct")}</th>
                    <th className="px-6 py-4 text-center">{t("colQty")}</th>
                    <th className="px-6 py-4">{t("colUnit")}</th>
                    <th className="px-6 py-4">{t("colNote")}</th>
                    <th className="px-6 py-4">{t("colManager")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-400">{t("noMovements")}</td>
                    </tr>
                  ) : (
                    movements.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-gray-400">{m.id}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-xs text-gray-500">{m.time}</td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {m.type === "MOVE_IN"
                            ? <span className="inline-flex rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 border border-green-100">{t("typeIn")}</span>
                            : <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-100">{t("typeOut")}</span>
                          }
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-900">{m.itemName}</td>
                        <td className={`whitespace-nowrap px-6 py-4 text-center font-black text-base ${m.type === "MOVE_IN" ? "text-green-600" : "text-red-500"}`}>
                          {m.type === "MOVE_IN" ? `+${m.qty}` : `-${m.qty}`}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-xs text-gray-500 font-medium">{m.unit}</td>
                        <td className="px-6 py-4 text-gray-500 text-xs max-w-xs truncate">{m.note}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-gray-800 font-semibold text-xs">{m.user}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ตารางประวัติเบิกเงิน */}
        <div className="mt-10">
          <h2 className="text-xl font-bold tracking-tight mb-4">{t("cashHistoryTitle")}</h2>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/70 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    <th className="px-6 py-4">{t("colLogId")}</th>
                    <th className="px-6 py-4">{t("colTime")}</th>
                    <th className="px-6 py-4 text-center">{t("colAmount")}</th>
                    <th className="px-6 py-4">{t("colReason")}</th>
                    <th className="px-6 py-4">{t("colWithdrawBy")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {cashWithdrawals.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">{t("noCash")}</td>
                    </tr>
                  ) : (
                    cashWithdrawals.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-gray-400">{c.id}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-xs text-gray-500">{c.time}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-center font-black text-base text-orange-600">
                          -{Number(c.amount).toLocaleString()} {t("baht")}
                        </td>
                        <td className="px-6 py-4 text-gray-700 text-xs max-w-xs truncate">{c.reason}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-gray-800 font-semibold text-xs">{c.user}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}