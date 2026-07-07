"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { DEFAULT_COUNTRY_CODE } from "@/lib/countries";

interface Account {
  id: number;
  name: string;
  accountType: string;
  currentBalance: string;
  isDefaultCash: boolean;
}

interface Category {
  id: number;
  name: string;
  type: "income" | "expense";
  isSystem: boolean;
}

interface Transaction {
  id: number;
  type: "income" | "expense" | "transfer";
  amount: string;
  note: string | null;
  businessDate: string;
  source: "manual" | "cash_closing";
  accountName: string | null;
  transferToAccountName: string | null;
  categoryName: string | null;
  createdByName: string | null;
}

type TxType = "income" | "expense" | "transfer";

function AccountingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [storeId, setStoreId] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [txType, setTxType] = useState<TxType>("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [transferToAccountId, setTransferToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadAll = useCallback(async (sid: string) => {
    const [storeRes, accountsRes, categoriesRes, txRes] = await Promise.all([
      fetch(`/api/stores/${sid}`),
      fetch(`/api/accounts?storeId=${sid}`),
      fetch(`/api/categories?storeId=${sid}`),
      fetch(`/api/transactions?storeId=${sid}`),
    ]);
    if (storeRes.ok) {
      const store = await storeRes.json();
      if (store?.country) setCountry(store.country);
    }
    if (accountsRes.ok) {
      const data: Account[] = await accountsRes.json();
      setAccounts(data);
      // Functional update: reads the current accountId at call time rather than the value
      // captured when this callback was created, so it doesn't reset the user's selection
      // back to the default account every time loadAll re-runs (e.g. after a submit).
      setAccountId(prev => prev || String(data.find(a => a.isDefaultCash)?.id ?? data[0]?.id ?? ""));
    }
    if (categoriesRes.ok) setCategories(await categoriesRes.json());
    if (txRes.ok) setTransactions(await txRes.json());
  }, []);

  useEffect(() => {
    async function init() {
      let sid = searchParams.get("storeId");
      if (!sid) {
        const stores = await fetch("/api/stores").then(r => r.ok ? r.json() : []);
        if (stores[0]?.id) sid = String(stores[0].id);
      }
      if (!sid) { setLoading(false); setMounted(true); return; }
      setStoreId(sid);
      await loadAll(sid);
      setLoading(false);
      setMounted(true);
    }
    init();
  }, [searchParams, loadAll]);

  const filteredCategories = categories.filter(c => c.type === txType);

  const openForm = (type: TxType) => {
    setTxType(type);
    setCategoryId("");
    setTransferToAccountId("");
    setAmount("");
    setNote("");
    setError("");
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");

    if (!amount || Number(amount) <= 0) return setError("กรุณากรอกจำนวนเงิน");
    if (!accountId) return setError("กรุณาเลือกบัญชี");
    if (txType !== "transfer" && !categoryId) return setError("กรุณาเลือกหมวดหมู่");
    if (txType === "transfer" && (!transferToAccountId || transferToAccountId === accountId)) {
      return setError("กรุณาเลือกบัญชีปลายทางที่ไม่ใช่บัญชีเดียวกัน");
    }

    setSubmitting(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId, accountId: Number(accountId), type: txType, amount: Number(amount),
        categoryId: txType !== "transfer" ? Number(categoryId) : null,
        transferToAccountId: txType === "transfer" ? Number(transferToAccountId) : null,
        note: note || null,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) return setError(data.error);

    setFormOpen(false);
    await loadAll(storeId);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-24">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <p className="text-base font-semibold text-gray-900">ระบบบัญชี</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">กำลังโหลด...</div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-5">
          {/* บัญชีและยอดคงเหลือ */}
          <div className="flex gap-3 overflow-x-auto pb-1">
            {accounts.map(a => (
              <div key={a.id} className="shrink-0 min-w-[140px] bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-[11px] font-semibold text-gray-400">{a.name}{a.isDefaultCash ? " (หลัก)" : ""}</p>
                <p className="text-lg font-black text-gray-900 mt-1">{formatCurrency(Number(a.currentBalance), country)}</p>
              </div>
            ))}
          </div>

          {/* ปุ่มเพิ่มรายการ */}
          <div className="grid grid-cols-3 gap-3">
            <button onClick={() => openForm("income")} className="rounded-2xl border border-emerald-100 bg-emerald-50 py-3 text-xs font-bold text-emerald-700 hover:border-emerald-400 transition-all">
              + รายรับ
            </button>
            <button onClick={() => openForm("expense")} className="rounded-2xl border border-red-100 bg-red-50 py-3 text-xs font-bold text-red-600 hover:border-red-400 transition-all">
              + รายจ่าย
            </button>
            <button onClick={() => openForm("transfer")} className="rounded-2xl border border-blue-100 bg-blue-50 py-3 text-xs font-bold text-blue-600 hover:border-blue-400 transition-all">
              + โอนเงิน
            </button>
          </div>

          {/* รายการล่าสุด */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-sm font-bold text-gray-800 mb-4">รายการล่าสุด</p>
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">ยังไม่มีรายการ</p>
            ) : (
              <div className="flex flex-col gap-2">
                {transactions.map(t => {
                  const amt = Number(t.amount);
                  const sign = t.type === "income" ? "+" : t.type === "expense" ? "-" : "";
                  const color = t.type === "income" ? "text-emerald-600" : t.type === "expense" ? "text-red-500" : "text-blue-600";
                  const label = t.type === "transfer"
                    ? `โอน · ${t.accountName} → ${t.transferToAccountName}`
                    : `${t.categoryName ?? "-"} · ${t.accountName}`;
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-3 border-b border-gray-50 last:border-0 pb-2.5 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{label}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {t.businessDate.slice(0, 10)} · {t.note || (t.source === "cash_closing" ? "ปิดยอดเงินสด (อัตโนมัติ)" : t.createdByName ?? "-")}
                        </p>
                      </div>
                      <span className={`text-xs font-bold shrink-0 ${color}`}>{sign}{formatCurrency(amt, country)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Link href={`/dashboard${storeId ? `?storeId=${storeId}` : ""}`} className="text-center text-xs text-gray-400 hover:text-black transition-colors">
            กลับหน้า Dashboard
          </Link>
        </div>
      )}

      {/* Add Transaction Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}>
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="font-bold text-gray-900 text-lg">
                {txType === "income" ? "เพิ่มรายรับ" : txType === "expense" ? "เพิ่มรายจ่าย" : "โอนเงินระหว่างบัญชี"}
              </p>
              <button type="button" onClick={() => setFormOpen(false)} className="text-gray-400 hover:text-black text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">จำนวนเงิน</label>
                <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-lg font-semibold text-center outline-none focus:border-black focus:bg-white transition-all" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">{txType === "transfer" ? "บัญชีต้นทาง" : "บัญชี"}</label>
                <select value={accountId} onChange={e => setAccountId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all">
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              {txType === "transfer" ? (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">บัญชีปลายทาง</label>
                  <select value={transferToAccountId} onChange={e => setTransferToAccountId(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all">
                    <option value="">-- เลือกบัญชีปลายทาง --</option>
                    {accounts.filter(a => String(a.id) !== accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">หมวดหมู่</label>
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all">
                    <option value="">-- เลือกหมวดหมู่ --</option>
                    {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">โน้ต (ถ้ามี)</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="รายละเอียดเพิ่มเติม"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all" />
              </div>
            </div>

            {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mt-4">{error}</p>}

            <div className="flex gap-2 mt-6">
              <button type="button" onClick={() => setFormOpen(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:border-gray-400 transition-all">
                ยกเลิก
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 rounded-xl bg-black py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-all disabled:bg-gray-200 disabled:text-gray-400">
                {submitting ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function AccountingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">กำลังโหลด...</div>}>
      <AccountingContent />
    </Suspense>
  );
}
