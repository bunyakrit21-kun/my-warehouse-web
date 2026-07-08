"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { DEFAULT_COUNTRY_CODE } from "@/lib/countries";
import { Icon, IconPicker, IconName } from "@/components/icon-picker";
import PasswordInput from "@/components/PasswordInput";

interface Account {
  id: number; name: string; accountType: string; icon: string | null;
  currentBalance: string; isDefaultCash: boolean; isSystem: boolean;
}
interface Category {
  id: number; name: string; type: "income" | "expense"; icon: string; isSystem: boolean;
}
interface Transaction {
  id: number; type: "income" | "expense" | "transfer"; amount: string; note: string | null;
  businessDate: string; source: "manual" | "cash_closing" | "cash_closing_dayclose" | "cash_withdrawal";
  accountName: string | null; transferToAccountName: string | null;
  categoryId: number | null; categoryName: string | null; categoryType?: string | null; createdByName: string | null;
}
type TxType = "income" | "expense" | "transfer";

const ACCOUNT_TYPE_LABEL: Record<string, string> = { cash: "เงินสด", bank: "ธนาคาร", "e-wallet": "อีวอลเล็ต", other: "อื่นๆ" };
const WEEKDAY_TH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const MONTH_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthRange(monthDate: Date): { from: string; to: string } {
  const from = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const to = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  return { from: toDateStr(from), to: toDateStr(to) };
}

function AccountingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [storeId, setStoreId] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE);
  const [mounted, setMounted] = useState(false);

  // Step-up gate (spec-07 §6.1) — must pass before any accounting data loads.
  const [stepUpVerified, setStepUpVerified] = useState<boolean | null>(null);
  const [stepUpPassword, setStepUpPassword] = useState("");
  const [stepUpError, setStepUpError] = useState("");
  const [stepUpBusy, setStepUpBusy] = useState(false);

  const [tab, setTab] = useState<"list" | "summary">("list");
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-transaction modal
  const [formOpen, setFormOpen] = useState(false);
  const [txType, setTxType] = useState<TxType>("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [transferToAccountId, setTransferToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Edit-transaction modal (spec-07 §6.2 — password required every time)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editError, setEditError] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // "จัดการบัญชี" modal
  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState<"accounts" | "categories">("accounts");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState("cash");
  const [newAccountIcon, setNewAccountIcon] = useState<IconName>("cash");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<"income" | "expense">("expense");
  const [newCategoryIcon, setNewCategoryIcon] = useState<IconName>("tag");
  const [manageError, setManageError] = useState("");
  const [manageBusy, setManageBusy] = useState(false);

  const checkStepUp = useCallback(async () => {
    const res = await fetch("/api/auth/step-up-status");
    const data = res.ok ? await res.json() : { verified: false };
    setStepUpVerified(!!data.verified);
  }, []);

  const submitStepUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stepUpBusy) return;
    setStepUpError("");
    setStepUpBusy(true);
    const res = await fetch("/api/auth/verify-step-up", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: stepUpPassword }),
    });
    const data = await res.json();
    setStepUpBusy(false);
    if (!res.ok) return setStepUpError(data.error || "เกิดข้อผิดพลาด");
    setStepUpPassword("");
    setStepUpVerified(true);
  };

  const loadAll = useCallback(async (sid: string, month: Date) => {
    const { from, to } = monthRange(month);
    const [storeRes, accountsRes, categoriesRes, txRes] = await Promise.all([
      fetch(`/api/stores/${sid}`),
      fetch(`/api/accounts?storeId=${sid}`),
      fetch(`/api/categories?storeId=${sid}`),
      fetch(`/api/transactions?storeId=${sid}&from=${from}&to=${to}`),
    ]);
    if (storeRes.ok) {
      const store = await storeRes.json();
      if (store?.country) setCountry(store.country);
    }
    if (accountsRes.ok) {
      const data: Account[] = await accountsRes.json();
      setAccounts(data);
      setAccountId(prev => prev || String(data.find(a => a.isDefaultCash)?.id ?? data[0]?.id ?? ""));
    }
    if (categoriesRes.ok) setCategories(await categoriesRes.json());
    if (txRes.ok) setTransactions(await txRes.json());
  }, []);

  useEffect(() => { checkStepUp(); }, [checkStepUp]);

  useEffect(() => {
    async function init() {
      let sid = searchParams.get("storeId");
      if (!sid) {
        const stores = await fetch("/api/stores").then(r => r.ok ? r.json() : []);
        if (stores[0]?.id) sid = String(stores[0].id);
      }
      if (!sid) { setLoading(false); setMounted(true); return; }
      setStoreId(sid);
      if (stepUpVerified) await loadAll(sid, monthDate);
      setLoading(false);
      setMounted(true);
    }
    if (stepUpVerified !== null) init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, stepUpVerified]);

  useEffect(() => {
    if (storeId && stepUpVerified) loadAll(storeId, monthDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthDate]);

  const filteredCategories = categories.filter(c => c.type === txType);
  const q = storeId ? `?storeId=${storeId}` : "";

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
      method: "POST", headers: { "Content-Type": "application/json" },
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
    await loadAll(storeId, monthDate);
  };

  const openEdit = (tx: Transaction) => {
    if (tx.source !== "manual") return;
    setEditingTx(tx);
    setEditAmount(tx.amount);
    setEditNote(tx.note ?? "");
    setEditCategoryId(tx.categoryId ? String(tx.categoryId) : "");
    setEditPassword("");
    setEditError("");
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || editSubmitting) return;
    setEditError("");
    if (!editAmount || Number(editAmount) <= 0) return setEditError("กรุณากรอกจำนวนเงิน");
    if (!editPassword) return setEditError("กรุณายืนยันรหัสผ่านก่อนบันทึก");
    setEditSubmitting(true);
    const res = await fetch(`/api/transactions/${editingTx.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: editPassword, amount: Number(editAmount), note: editNote || null,
        categoryId: editingTx.type !== "transfer" ? Number(editCategoryId) : undefined,
      }),
    });
    const data = await res.json();
    setEditSubmitting(false);
    if (!res.ok) return setEditError(data.error);
    setEditingTx(null);
    await loadAll(storeId, monthDate);
  };

  const deleteTx = async () => {
    if (!editingTx || editSubmitting) return;
    setEditError("");
    if (!editPassword) return setEditError("กรุณายืนยันรหัสผ่านก่อนลบ");
    if (!window.confirm("ยืนยันลบรายการนี้? ยอดบัญชีจะถูกปรับคืนอัตโนมัติ")) return;
    setEditSubmitting(true);
    const res = await fetch(`/api/transactions/${editingTx.id}`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: editPassword }),
    });
    const data = await res.json();
    setEditSubmitting(false);
    if (!res.ok) return setEditError(data.error);
    setEditingTx(null);
    await loadAll(storeId, monthDate);
  };

  const createAccount = async () => {
    if (!newAccountName.trim()) return setManageError("กรุณาระบุชื่อบัญชี");
    setManageBusy(true); setManageError("");
    const res = await fetch("/api/accounts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, name: newAccountName, accountType: newAccountType, icon: newAccountIcon }),
    });
    const data = await res.json();
    setManageBusy(false);
    if (!res.ok) return setManageError(data.error);
    setNewAccountName("");
    await loadAll(storeId, monthDate);
  };

  const archiveAccount = async (id: number) => {
    setManageBusy(true); setManageError("");
    const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    const data = await res.json();
    setManageBusy(false);
    if (!res.ok) return setManageError(data.error);
    await loadAll(storeId, monthDate);
  };

  const updateAccountIcon = async (a: Account, icon: IconName) => {
    await fetch(`/api/accounts/${a.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: a.name, icon, accountType: a.accountType }),
    });
    await loadAll(storeId, monthDate);
  };

  const createCategory = async () => {
    if (!newCategoryName.trim()) return setManageError("กรุณาระบุชื่อหมวดหมู่");
    setManageBusy(true); setManageError("");
    const res = await fetch("/api/categories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, name: newCategoryName, type: newCategoryType, icon: newCategoryIcon }),
    });
    const data = await res.json();
    setManageBusy(false);
    if (!res.ok) return setManageError(data.error);
    setNewCategoryName("");
    await loadAll(storeId, monthDate);
  };

  const deleteCategory = async (id: number) => {
    setManageBusy(true); setManageError("");
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    const data = await res.json();
    setManageBusy(false);
    if (!res.ok) return setManageError(data.error);
    await loadAll(storeId, monthDate);
  };

  const updateCategoryIcon = async (c: Category, icon: IconName) => {
    await fetch(`/api/categories/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: c.name, icon }),
    });
    await loadAll(storeId, monthDate);
  };

  // --- Calendar (Tab 1) ---
  const netByDate = new Map<string, number>();
  for (const t of transactions) {
    const d = t.businessDate.slice(0, 10);
    const amt = Number(t.amount);
    const delta = t.type === "income" ? amt : t.type === "expense" ? -amt : 0;
    netByDate.set(d, (netByDate.get(d) ?? 0) + delta);
  }
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const calendarCells: (string | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDateStr(new Date(monthDate.getFullYear(), monthDate.getMonth(), i + 1))),
  ];
  const dayTransactions = transactions
    .filter(t => t.businessDate.slice(0, 10) === selectedDate)
    .sort((a, b) => b.id - a.id);

  // --- Summary (Tab 2) ---
  const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const expenseByCategory = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const key = t.categoryName ?? "อื่นๆ";
    expenseByCategory.set(key, (expenseByCategory.get(key) ?? 0) + Number(t.amount));
  }
  const expenseBreakdown = Array.from(expenseByCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, amt]) => ({ name, amt, pct: totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0 }));

  if (!mounted && stepUpVerified === null) return null;

  // Step-up gate — blocks everything else until password re-confirmed (spec-07 §6.1)
  if (stepUpVerified === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <form onSubmit={submitStepUp} className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm p-6">
          <div className="w-11 h-11 rounded-2xl bg-gray-900 text-white flex items-center justify-center mb-4">
            <Icon name="wallet" className="w-5 h-5" />
          </div>
          <p className="font-bold text-gray-900 text-lg">ยืนยันตัวตนอีกครั้ง</p>
          <p className="text-xs text-gray-500 mt-1 mb-5">หน้าระบบบัญชีเห็นเงินจริงทั้งหมดของร้าน กรุณากรอกรหัสผ่านเพื่อเข้าใช้งาน</p>
          <PasswordInput value={stepUpPassword} onChange={setStepUpPassword} placeholder="รหัสผ่าน" required autoComplete="current-password" />
          {stepUpError && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mt-3">{stepUpError}</p>}
          <button type="submit" disabled={stepUpBusy}
            className="w-full mt-4 rounded-xl bg-black py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-all disabled:bg-gray-200 disabled:text-gray-400">
            {stepUpBusy ? "กำลังตรวจสอบ..." : "ยืนยัน"}
          </button>
          <Link href={`/dashboard${q}`} className="block text-center text-xs text-gray-400 hover:text-black mt-4">ยกเลิก กลับหน้า Dashboard</Link>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-24">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="w-9 h-9 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7" /></svg>
            </button>
            <p className="text-base font-semibold text-gray-900">บัญชี</p>
          </div>
          <button onClick={() => setManageOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50">
            <Icon name="wallet" className="w-4 h-4" /> จัดการบัญชี
          </button>
        </div>
        <div className="max-w-3xl mx-auto px-4 flex gap-1 border-t border-gray-50">
          {([["list", "รายการ"], ["summary", "สรุป"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${tab === key ? "border-black text-black" : "border-transparent text-gray-400"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">กำลังโหลด...</div>
      ) : (
        <div className="max-w-3xl mx-auto px-4 pt-6 flex flex-col gap-5">
          {/* บัญชีและยอดคงเหลือ */}
          <div className="flex gap-3 overflow-x-auto pb-1">
            {accounts.map(a => (
              <div key={a.id} className="shrink-0 min-w-[150px] bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                  <Icon name={a.icon ?? "dots"} className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-gray-400 truncate">{a.name}{a.isDefaultCash ? " (หลัก)" : ""}</p>
                  <p className="text-base font-black text-gray-900 mt-0.5">{formatCurrency(Number(a.currentBalance), country)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button onClick={() => openForm("income")} className="rounded-2xl border border-emerald-100 bg-emerald-50 py-3 text-xs font-bold text-emerald-700 hover:border-emerald-400 transition-all">+ รายรับ</button>
            <button onClick={() => openForm("expense")} className="rounded-2xl border border-red-100 bg-red-50 py-3 text-xs font-bold text-red-600 hover:border-red-400 transition-all">+ รายจ่าย</button>
            <button onClick={() => openForm("transfer")} className="rounded-2xl border border-blue-100 bg-blue-50 py-3 text-xs font-bold text-blue-600 hover:border-blue-400 transition-all">+ โอนเงิน</button>
          </div>

          {tab === "list" ? (
            <>
              {/* ปฏิทินรายเดือน */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <p className="text-sm font-bold text-gray-800">{MONTH_TH[monthDate.getMonth()]} {monthDate.getFullYear() + 543}</p>
                  <button onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-gray-400 mb-2">
                  {WEEKDAY_TH.map(w => <span key={w}>{w}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((date, i) => {
                    if (!date) return <div key={i} />;
                    const net = netByDate.get(date);
                    const isSelected = date === selectedDate;
                    const dayNum = Number(date.slice(8, 10));
                    return (
                      <button key={date} onClick={() => setSelectedDate(date)}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] transition-all ${
                          isSelected ? "bg-black text-white" : "hover:bg-gray-50 text-gray-700"
                        }`}>
                        <span className="font-semibold">{dayNum}</span>
                        {net !== undefined && net !== 0 && (
                          <span className={`w-1.5 h-1.5 rounded-full ${net > 0 ? "bg-emerald-500" : "bg-red-500"} ${isSelected ? "!bg-white" : ""}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* รายการของวันที่เลือก */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-sm font-bold text-gray-800 mb-4">รายการวันที่ {Number(selectedDate.slice(8, 10))} {MONTH_TH[Number(selectedDate.slice(5, 7)) - 1]}</p>
                {dayTransactions.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">ไม่มีรายการวันนี้</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {dayTransactions.map(t => {
                      const amt = Number(t.amount);
                      const sign = t.type === "income" ? "+" : t.type === "expense" ? "-" : "";
                      const color = t.type === "income" ? "text-emerald-600" : t.type === "expense" ? "text-red-500" : "text-blue-600";
                      const label = t.type === "transfer" ? `โอน · ${t.accountName} → ${t.transferToAccountName}` : `${t.categoryName ?? "-"} · ${t.accountName}`;
                      const editable = t.source === "manual";
                      return (
                        <button key={t.id} onClick={() => editable && openEdit(t)} disabled={!editable}
                          className={`flex items-center justify-between gap-3 border-b border-gray-50 last:border-0 pb-2.5 last:pb-0 text-left ${editable ? "hover:bg-gray-50 -mx-2 px-2 rounded-lg" : ""}`}>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">{label}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {t.note || (t.source !== "manual" ? "รายการอัตโนมัติจากระบบ" : t.createdByName ?? "-")}
                            </p>
                          </div>
                          <span className={`text-xs font-bold shrink-0 ${color}`}>{sign}{formatCurrency(amt, country)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* สรุป — พื้นฐาน (Phase 1); กราฟ Net Worth เต็มรูปแบบเป็น Phase 2 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="text-[11px] font-semibold text-gray-400">รายรับเดือนนี้</p>
                  <p className="text-lg font-black text-emerald-600 mt-1">{formatCurrency(totalIncome, country)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="text-[11px] font-semibold text-gray-400">รายจ่ายเดือนนี้</p>
                  <p className="text-lg font-black text-red-500 mt-1">{formatCurrency(totalExpense, country)}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-sm font-bold text-gray-800 mb-4">รายจ่ายแยกตามหมวดหมู่</p>
                {expenseBreakdown.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">ยังไม่มีรายจ่ายเดือนนี้</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {expenseBreakdown.map(row => (
                      <div key={row.name}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-gray-700">{row.name}</span>
                          <span className="text-gray-400">{formatCurrency(row.amt, country)} · {row.pct}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-gray-900" style={{ width: `${row.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <Link href={`/dashboard${q}`} className="text-center text-xs text-gray-400 hover:text-black transition-colors">กลับหน้า Dashboard</Link>
        </div>
      )}

      {/* Add Transaction Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}>
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="font-bold text-gray-900 text-lg">{txType === "income" ? "เพิ่มรายรับ" : txType === "expense" ? "เพิ่มรายจ่าย" : "โอนเงินระหว่างบัญชี"}</p>
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
                <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all">
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              {txType === "transfer" ? (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">บัญชีปลายทาง</label>
                  <select value={transferToAccountId} onChange={e => setTransferToAccountId(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all">
                    <option value="">-- เลือกบัญชีปลายทาง --</option>
                    {accounts.filter(a => String(a.id) !== accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">หมวดหมู่</label>
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all">
                    <option value="">-- เลือกหมวดหมู่ --</option>
                    {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">โน้ต (ถ้ามี)</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="รายละเอียดเพิ่มเติม" className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all" />
              </div>
            </div>
            {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mt-4">{error}</p>}
            <div className="flex gap-2 mt-6">
              <button type="button" onClick={() => setFormOpen(false)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:border-gray-400 transition-all">ยกเลิก</button>
              <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-black py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-all disabled:bg-gray-200 disabled:text-gray-400">
                {submitting ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Transaction Modal — password required every time (spec-07 §6.2) */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setEditingTx(null); }}>
          <form onSubmit={submitEdit} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="font-bold text-gray-900 text-lg">แก้ไขรายการ</p>
              <button type="button" onClick={() => setEditingTx(null)} className="text-gray-400 hover:text-black text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">จำนวนเงิน</label>
                <input type="number" inputMode="decimal" min="0" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-lg font-semibold text-center outline-none focus:border-black focus:bg-white transition-all" />
              </div>
              {editingTx.type !== "transfer" && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">หมวดหมู่</label>
                  <select value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all">
                    {categories.filter(c => c.type === editingTx.type).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">โน้ต (ถ้ามี)</label>
                <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-black focus:bg-white transition-all" />
              </div>
              <div className="pt-2 border-t border-gray-100">
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">ยืนยันรหัสผ่านก่อนบันทึก</label>
                <PasswordInput value={editPassword} onChange={setEditPassword} placeholder="รหัสผ่าน" required autoComplete="current-password" />
              </div>
            </div>
            {editError && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mt-4">{editError}</p>}
            <div className="flex gap-2 mt-6">
              <button type="button" onClick={deleteTx} disabled={editSubmitting}
                className="rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-all disabled:opacity-40">
                ลบ
              </button>
              <button type="button" onClick={() => setEditingTx(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:border-gray-400 transition-all">ยกเลิก</button>
              <button type="submit" disabled={editSubmitting} className="flex-1 rounded-xl bg-black py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-all disabled:bg-gray-200 disabled:text-gray-400">
                {editSubmitting ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* จัดการบัญชี / หมวดหมู่ Modal */}
      {manageOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setManageOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-gray-900 text-lg">จัดการบัญชี</p>
              <button onClick={() => setManageOpen(false)} className="text-gray-400 hover:text-black text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">✕</button>
            </div>
            <div className="flex gap-1 border-b border-gray-100 mb-4">
              {([["accounts", "บัญชี/กระเป๋าเงิน"], ["categories", "หมวดหมู่"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setManageTab(key)} className={`px-3 py-2 text-xs font-bold border-b-2 ${manageTab === key ? "border-black text-black" : "border-transparent text-gray-400"}`}>{label}</button>
              ))}
            </div>

            {manageError && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-3">{manageError}</p>}

            {manageTab === "accounts" ? (
              <div className="flex flex-col gap-3">
                {accounts.map(a => (
                  <div key={a.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon name={a.icon ?? "dots"} className="w-4 h-4 text-gray-500 shrink-0" />
                        <p className="text-sm font-semibold text-gray-800 truncate">{a.name}</p>
                        <span className="text-[10px] text-gray-400 shrink-0">{ACCOUNT_TYPE_LABEL[a.accountType]}</span>
                      </div>
                      {!a.isSystem && (
                        <button disabled={manageBusy} onClick={() => archiveAccount(a.id)} className="text-[11px] font-semibold text-red-500 hover:text-red-700 shrink-0">เก็บเข้าคลัง</button>
                      )}
                    </div>
                    <IconPicker value={a.icon ?? ""} onChange={icon => updateAccountIcon(a, icon)} />
                  </div>
                ))}
                <div className="border border-dashed border-gray-200 rounded-xl p-3 mt-1">
                  <p className="text-xs font-semibold text-gray-600 mb-2">เพิ่มบัญชีใหม่</p>
                  <input value={newAccountName} onChange={e => setNewAccountName(e.target.value)} placeholder="ชื่อบัญชี เช่น ธนาคารกสิกร"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-black mb-2" />
                  <select value={newAccountType} onChange={e => { setNewAccountType(e.target.value); setNewAccountIcon(e.target.value === "bank" ? "bank" : e.target.value === "e-wallet" ? "wallet" : e.target.value === "cash" ? "cash" : "dots"); }}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-black mb-2">
                    {Object.entries(ACCOUNT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <div className="mb-2"><IconPicker value={newAccountIcon} onChange={setNewAccountIcon} /></div>
                  <button disabled={manageBusy} onClick={createAccount} className="w-full rounded-lg bg-black py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:bg-gray-200">เพิ่มบัญชี</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {(["income", "expense"] as const).map(t => (
                  <div key={t}>
                    <p className="text-[11px] font-bold text-gray-400 mb-2">{t === "income" ? "หมวดรายรับ" : "หมวดรายจ่าย"}</p>
                    <div className="flex flex-col gap-2">
                      {categories.filter(c => c.type === t).map(c => (
                        <div key={c.id} className="border border-gray-100 rounded-xl p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon name={c.icon} className="w-4 h-4 text-gray-500 shrink-0" />
                              <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                            </div>
                            {!c.isSystem && (
                              <button disabled={manageBusy} onClick={() => deleteCategory(c.id)} className="text-[11px] font-semibold text-red-500 hover:text-red-700 shrink-0">ลบ</button>
                            )}
                          </div>
                          <IconPicker value={c.icon} onChange={icon => updateCategoryIcon(c, icon)} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="border border-dashed border-gray-200 rounded-xl p-3 mt-1">
                  <p className="text-xs font-semibold text-gray-600 mb-2">เพิ่มหมวดหมู่ใหม่</p>
                  <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="ชื่อหมวดหมู่"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-black mb-2" />
                  <select value={newCategoryType} onChange={e => setNewCategoryType(e.target.value as "income" | "expense")}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-black mb-2">
                    <option value="expense">รายจ่าย</option>
                    <option value="income">รายรับ</option>
                  </select>
                  <div className="mb-2"><IconPicker value={newCategoryIcon} onChange={setNewCategoryIcon} /></div>
                  <button disabled={manageBusy} onClick={createCategory} className="w-full rounded-lg bg-black py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:bg-gray-200">เพิ่มหมวดหมู่</button>
                </div>
              </div>
            )}
          </div>
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
