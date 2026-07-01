"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useT, LangSwitcher } from "@/lib/i18n";

interface SummaryRow {
  id: string;
  name: string;
  unit: string;
  image: string;
  parLevel: number | null;
  remainingToday: number | null;
  wasteToday: number | null;
  checkedByName: string | null;
  checkedAt: string | null;
  avgRemaining: number | null;
  suggestOrder: number | null;
}

function FreshSummaryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useT();

  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [error, setError] = useState("");

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

      const res = await fetch(`/api/daily-checks/summary?storeId=${sid}`);
      if (res.status === 403) { setError("ไม่มีสิทธิ์เข้าถึง"); setLoading(false); setMounted(true); return; }
      if (!res.ok) { setError("เกิดข้อผิดพลาด"); setLoading(false); setMounted(true); return; }
      setRows(await res.json());
      setLoading(false);
      setMounted(true);
    }
    init();
  }, [searchParams]);

  const handlePrint = () => window.print();
  const checkedCount = rows.filter(r => r.remainingToday !== null).length;

  if (!mounted) return null;
  if (loading) return <div className="p-8 text-center text-gray-400">{t("loading")}</div>;

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <style>{`
        @media print {
          header, .no-print { display: none !important; }
          main { background: white !important; padding: 0 !important; }
          .print-table { box-shadow: none !important; border: 1px solid #ccc !important; }
        }
      `}</style>

      <header className="border-b border-gray-100 bg-white sticky top-0 z-10 no-print">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/dashboard")}
              className="grid h-9 w-9 place-items-center rounded-xl border border-gray-200 hover:border-black transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-gray-900">{t("freshSummaryTitle")}</h1>
              <p className="text-xs text-gray-400">{new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold hover:border-black transition-all">
              🖨️ พิมพ์
            </button>
            <LangSwitcher />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6 space-y-4">
        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-5 text-center text-sm text-red-700">{error}</div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white border border-gray-200 p-5 text-center">
            <p className="text-3xl font-black text-gray-900">{rows.length}</p>
            <p className="text-xs text-gray-400 mt-1">สินค้าของสดทั้งหมด</p>
          </div>
          <div className={`rounded-2xl border p-5 text-center ${checkedCount === rows.length && rows.length > 0 ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
            <p className="text-3xl font-black text-gray-900">{checkedCount}</p>
            <p className="text-xs text-gray-400 mt-1">{t("checkedToday")}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 text-center">
            <p className="text-3xl font-black text-amber-700">
              {rows.filter(r => (r.suggestOrder ?? 0) > 0).length}
            </p>
            <p className="text-xs text-gray-400 mt-1">รายการที่ควรสั่ง</p>
          </div>
        </div>

        {/* Summary table */}
        {rows.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">🥬</div>
            <p className="text-sm text-gray-500">{t("freshItemsEmpty")}</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-x-auto print-table">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-800">ตารางรายละเอียด — {new Date().toLocaleDateString("th-TH")}</h2>
              <p className="text-xs text-gray-400">storeId: {storeId}</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 font-semibold">
                  <th className="text-left px-5 py-3">สินค้า</th>
                  <th className="text-right px-4 py-3">{t("colParLevel")}</th>
                  <th className="text-right px-4 py-3">{t("remainingQtyLabel")}</th>
                  <th className="text-right px-4 py-3">{t("wasteQtyLabel")}</th>
                  <th className="text-right px-4 py-3">{t("colAvgPerDay")}</th>
                  <th className="text-right px-4 py-3 text-amber-600">{t("colSuggestOrder")}</th>
                  <th className="text-left px-4 py-3">{t("colCheckedBy")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} className={`border-b border-gray-50 ${i % 2 === 1 ? "bg-gray-50/50" : ""}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {row.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.image} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-green-50 grid place-items-center text-sm">🥬</div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">{row.name}</p>
                          <p className="text-xs text-gray-400">{row.unit}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.parLevel ?? "–"}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${row.remainingToday !== null ? "text-gray-900" : "text-gray-300"}`}>
                      {row.remainingToday ?? "–"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{row.wasteToday ?? "–"}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{row.avgRemaining ?? "–"}</td>
                    <td className="px-4 py-3 text-right">
                      {row.suggestOrder !== null ? (
                        <span className={`inline-block font-bold rounded-lg px-2 py-0.5 ${row.suggestOrder > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                          {row.suggestOrder > 0 ? `+${row.suggestOrder}` : "✓ พอ"}
                        </span>
                      ) : "–"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {row.checkedByName ? (
                        <div>
                          <p>{row.checkedByName}</p>
                          {row.checkedAt && <p className="text-gray-300">{new Date(row.checkedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</p>}
                        </div>
                      ) : (
                        <span className="text-amber-500 font-semibold">{t("notCheckedToday")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

export default function FreshSummaryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">กำลังโหลด...</div>}>
      <FreshSummaryContent />
    </Suspense>
  );
}
