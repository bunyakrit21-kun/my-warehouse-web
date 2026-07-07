"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PinBoxes from "@/components/PinBoxes";

interface FreshItem {
  id: string;
  name: string;
  unit: string;
  image: string;
}

interface TodayCheck {
  productId: string;
  remainingQty: number;
  checkedByName: string | null;
}

function FreshCheckContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [storeId, setStoreId] = useState<string>("");
  const [items, setItems] = useState<FreshItem[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [checkedToday, setCheckedToday] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // PIN modal
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState(["", "", "", ""]);
  const [pinError, setPinError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    async function init() {
      let sid = searchParams.get("storeId");
      if (!sid) {
        const r = await fetch("/api/stores");
        if (r.ok) {
          const stores = await r.json();
          if (stores[0]?.id) sid = String(stores[0].id);
        }
      }
      // staff JWT มี storeId ใน /api/auth/me
      if (!sid) {
        const me = await fetch("/api/auth/me").then(r => r.ok ? r.json() : null);
        if (me?.user?.storeId) sid = String(me.user.storeId);
      }
      if (!sid) { setLoading(false); setMounted(true); return; }
      setStoreId(sid);

      const [itemsRes, checksRes] = await Promise.all([
        fetch(`/api/fresh-items?storeId=${sid}`),
        fetch(`/api/daily-checks?storeId=${sid}`),
      ]);

      const itemsData: FreshItem[] = itemsRes.ok ? await itemsRes.json() : [];
      const checksData: TodayCheck[] = checksRes.ok ? await checksRes.json() : [];

      // pre-fill ค่าที่เคยเช็คไว้วันนี้
      const initialValues: Record<string, string> = {};
      const doneSet = new Set<string>();
      for (const c of checksData) {
        initialValues[String(c.productId)] = String(c.remainingQty);
        doneSet.add(String(c.productId));
      }

      setItems(itemsData);
      setValues(initialValues);
      setCheckedToday(doneSet);
      setLoading(false);
      setMounted(true);
    }
    init();
  }, [searchParams]);

  const filledCount = items.filter(it => values[it.id] !== undefined && values[it.id] !== "").length;

  const openPin = () => {
    if (filledCount === 0) return;
    setPin(["", "", "", ""]);
    setPinError("");
    setSavedOk(false);
    setPinOpen(true);
  };

  const handleSubmit = async () => {
    const pinStr = pin.join("");
    if (pinStr.length !== 4) { setPinError("กรุณากรอก PIN 4 หลัก"); return; }

    // verify PIN ก่อน
    const verifyRes = await fetch("/api/employees/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pinStr, storeId }),
    });
    if (!verifyRes.ok) { setPinError("PIN ไม่ถูกต้อง"); return; }

    setSubmitting(true);

    // ส่งทุก item ที่กรอกค่าไว้ (business date คำนวณฝั่ง server เสมอ)
    const promises = items
      .filter(it => values[it.id] !== undefined && values[it.id] !== "")
      .map(it =>
        fetch("/api/daily-checks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId: Number(storeId),
            productId: it.id,
            remainingQty: Number(values[it.id]),
            wasteQty: 0,
            pin: pinStr,
          }),
        })
      );

    const results = await Promise.all(promises);
    setSubmitting(false);

    if (results.every(r => r.ok)) {
      const newDone = new Set(checkedToday);
      items.filter(it => values[it.id] !== "").forEach(it => newDone.add(it.id));
      setCheckedToday(newDone);
      setSavedOk(true);
      setTimeout(() => { setPinOpen(false); setSavedOk(false); }, 1200);
    } else {
      setPinError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
  };

  const todayTH = new Date().toLocaleDateString("th-TH", {
    day: "numeric", month: "long", year: "numeric",
  });

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-orange-50/40 font-sans pb-32">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <p className="text-base font-semibold text-gray-900">เช็คผักสด</p>
            <p className="text-xs text-gray-400">{todayTH}</p>
          </div>
          {checkedToday.size > 0 && (
            <span className="ml-auto text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-3 py-1">
              ✓ {checkedToday.size}/{items.length} รายการ
            </span>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4">

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🥬</div>
            <p className="text-sm text-gray-500">ยังไม่มีสินค้าของสด</p>
            <p className="text-xs text-gray-400 mt-1">ให้แอดมินตั้งค่าที่หน้า Inventory ก่อน</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map(item => {
              const isDone = checkedToday.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border transition-all ${
                    isDone ? "border-orange-200" : "border-gray-100"
                  }`}
                >
                  {/* Icon / Image */}
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt=""
                      className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0 text-lg">
                      🥬
                    </div>
                  )}

                  {/* Name */}
                  <span className="flex-1 text-sm font-medium text-gray-800">
                    {item.name}
                    {isDone && <span className="ml-1.5 text-orange-500 text-xs">✓</span>}
                  </span>

                  {/* Input */}
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    placeholder="0"
                    value={values[item.id] ?? ""}
                    onChange={e => setValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                    className="w-16 text-center text-base font-semibold bg-gray-50 border border-gray-200 rounded-xl py-1.5 outline-none focus:border-orange-400 focus:bg-white transition-all"
                    aria-label={`${item.name} เหลือเท่าไหร่`}
                  />

                  {/* Unit */}
                  <span className="text-xs text-gray-400 w-6 flex-shrink-0">{item.unit}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Submit button — fixed bottom */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-100 px-4 py-4">
          <div className="max-w-lg mx-auto">
            <button
              onClick={openPin}
              disabled={filledCount === 0}
              className="w-full rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm py-4 transition-all"
            >
              {filledCount > 0 ? `บันทึกยอดวันนี้  (${filledCount} รายการ)` : "บันทึกยอดวันนี้"}
            </button>
          </div>
        </div>
      )}

      {/* PIN Bottom Sheet */}
      {pinOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget && !submitting) setPinOpen(false); }}
        >
          <div className="bg-white w-full max-w-sm rounded-t-3xl px-6 pt-6 pb-10">
            {savedOk ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-base font-bold text-green-700">บันทึกสำเร็จ!</p>
              </div>
            ) : (
              <>
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
                <p className="text-base font-semibold text-gray-900 text-center mb-1">ยืนยันตัวตน</p>
                <p className="text-xs text-gray-400 text-center mb-6">กรอก PIN พนักงานเพื่อบันทึกยอด</p>

                <PinBoxes value={pin} onChange={v => { setPin(v); setPinError(""); }} autoFocus />

                {pinError && (
                  <p className="text-xs text-red-500 text-center mt-3">{pinError}</p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting || pin.join("").length !== 4}
                  className="mt-6 w-full rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm py-4 transition-all"
                >
                  {submitting ? "กำลังบันทึก..." : "ยืนยัน"}
                </button>
                <button
                  onClick={() => setPinOpen(false)}
                  disabled={submitting}
                  className="mt-2 w-full py-2 text-sm text-gray-400 hover:text-gray-600"
                >
                  ยกเลิก
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FreshCheckPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">กำลังโหลด...</div>}>
      <FreshCheckContent />
    </Suspense>
  );
}
