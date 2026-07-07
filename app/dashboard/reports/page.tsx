"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useT, LangSwitcher } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { DEFAULT_COUNTRY_CODE } from "@/lib/countries";

interface Summary {
  total_in: number;
  total_out: number;
  volume_in: number;
  volume_out: number;
  total_movements: number;
}

interface CashSummary {
  total_withdrawals: number;
  total_amount: number;
}

interface TopProduct {
  name: string;
  total_in: number;
  total_out: number;
  total_movements: number;
}

interface DailyTrend {
  date: string;
  volume_in: number;
  volume_out: number;
}

type ChartType = "bar" | "stacked" | "table";
type Range = "today" | "week" | "month";

// Labels are built inside the component using t()
const RANGE_KEYS: Range[] = ["today", "week", "month"];
const CHART_KEYS: ChartType[] = ["bar", "stacked", "table"];

function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const bom = "﻿";
  const csv = bom + [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { t } = useT();
  const RANGE_LABEL: Record<Range, string> = { today: t("today"), week: t("week"), month: t("month") };
  const CHART_LABEL: Record<ChartType, string> = { bar: t("barChart"), stacked: t("stackedChart"), table: t("tableView") };
  const [range, setRange] = useState<Range>("week");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [cashSummary, setCashSummary] = useState<CashSummary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE);

  useEffect(() => {
    async function init() {
      const meData = await fetch("/api/auth/me").then(r => r.ok ? r.json() : null);
      const user = meData?.user;
      const sid = user?.type === "staff"
        ? String(user.storeId)
        : new URLSearchParams(window.location.search).get("storeId") ?? "";
      setStoreId(sid);
    }
    init();
  }, []);

  useEffect(() => {
    if (!storeId) return;
    fetch(`/api/stores/${storeId}`).then(r => r.ok ? r.json() : null).then(store => {
      if (store?.country) setCountry(store.country);
    });
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    async function load() {
      setLoading(true);
      const r = await fetch(`/api/reports?range=${range}&storeId=${storeId}`);
      const data = await r.json();
      setSummary(data.summary);
      setCashSummary(data.cashSummary);
      setTopProducts(data.topProducts ?? []);
      setDailyTrend(data.dailyTrend ?? []);
      setLoading(false);
    }
    load();
  }, [range, storeId]);

  const maxTopMovement = Math.max(...topProducts.map(p => Number(p.total_movements)), 1);
  const maxDailyVolume = Math.max(...dailyTrend.flatMap(d => [Number(d.volume_in), Number(d.volume_out)]), 1);

  const handleExportMovements = () => {
    exportCSV(
      `diam_movements_${range}.csv`,
      [t("csvDate"), t("statVolumeIn"), t("statVolumeOut"), t("csvNet")],
      dailyTrend.map(d => [
        new Date(d.date).toLocaleDateString("th-TH"),
        d.volume_in,
        d.volume_out,
        Number(d.volume_in) - Number(d.volume_out),
      ])
    );
  };

  const handleExportProducts = () => {
    exportCSV(
      `diam_products_${range}.csv`,
      [t("colProductName"), t("csvInCount"), t("csvOutCount"), t("csvTotalTxn")],
      topProducts.map(p => [p.name, p.total_in ?? 0, p.total_out ?? 0, p.total_movements])
    );
  };

  const handleExportAll = () => {
    exportCSV(
      `diam_report_${range}.csv`,
      [t("csvType"), t("csvItem"), t("csvValue")],
      [
        [t("csvCatSummary"), t("totalMovements"), summary?.total_movements ?? 0],
        [t("csvCatSummary"), t("statVolumeIn"), summary?.volume_in ?? 0],
        [t("csvCatSummary"), t("statVolumeOut"), summary?.volume_out ?? 0],
        [t("csvCatSummary"), t("csvNet"), (summary?.volume_in ?? 0) - (summary?.volume_out ?? 0)],
        [t("csvCatMoney"), t("csvCashTimes"), cashSummary?.total_withdrawals ?? 0],
        [t("csvCatMoney"), t("csvCashTotal"), cashSummary?.total_amount ?? 0],
        ...topProducts.map(p => [t("csvCatProduct"), p.name, p.total_movements]),
        ...dailyTrend.map(d => [t("csvCatDaily"), new Date(d.date).toLocaleDateString("th-TH"), `+${d.volume_in}/-${d.volume_out}`]),
      ]
    );
  };

  return (
    <main className="min-h-screen bg-gray-50 text-black font-sans antialiased pb-12">

      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white font-black text-base">D</div>
            <div className="leading-tight">
              <p className="text-base font-bold">DiaM</p>
              <p className="text-xs text-gray-400">{t("reportsTitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LangSwitcher />
            <Link href="/dashboard" className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold hover:border-black transition-all">
              {t("backToHome")}
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-8">

        {/* Controls row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">{t("reportsTitle")}</h1>
            <p className="mt-0.5 text-sm text-gray-500">{t("reportsSubtitle")} — {RANGE_LABEL[range]}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Range */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
              {RANGE_KEYS.map(r => (
                <button key={r} onClick={() => setRange(r)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${range === r ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"}`}>
                  {RANGE_LABEL[r]}
                </button>
              ))}
            </div>
            {/* Chart type */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
              {CHART_KEYS.map(c => (
                <button key={c} onClick={() => setChartType(c)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${chartType === c ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"}`}>
                  {CHART_LABEL[c]}
                </button>
              ))}
            </div>
            {/* Export */}
            <div className="relative group">
              <button className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold hover:border-black transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t("download")}
              </button>
              <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-gray-200 bg-white shadow-lg z-10 hidden group-hover:block">
                <button onClick={handleExportMovements} className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-gray-50 rounded-t-xl">
                  {t("trendCSV")}
                </button>
                <button onClick={handleExportProducts} className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-gray-50">
                  {t("topProductsCSV")}
                </button>
                <button onClick={handleExportAll} className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-gray-50 rounded-b-xl border-t border-gray-100">
                  {t("fullReportCSV")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-sm text-gray-400">{t("loadingData")}</div>
        ) : (
          <>
            {/* Quick Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              {[
                { label: t("totalMovements"), value: summary?.total_movements ?? 0, unit: t("items"), sub: `${t("totalMovementsSub")} ${summary?.total_in ?? 0} / ${t("totalMovementsOut")} ${summary?.total_out ?? 0}`, color: "text-gray-900" },
                { label: t("statVolumeIn"), value: `+${summary?.volume_in ?? 0}`, unit: "", sub: t("allUnits"), color: "text-green-600" },
                { label: t("statVolumeOut"), value: `-${summary?.volume_out ?? 0}`, unit: "", sub: t("allUnits"), color: "text-red-500" },
                { label: t("cashWithdrawStat"), value: formatCurrency(Number(cashSummary?.total_amount ?? 0), country), unit: "", sub: `${cashSummary?.total_withdrawals ?? 0} ${t("cashTimes")}`, color: "text-orange-500" },
              ].map(stat => (
                <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500">{stat.label}</p>
                  <p className={`mt-2 text-3xl font-black ${stat.color}`}>
                    {stat.value} {stat.unit && <span className="text-xs font-normal text-gray-400">{stat.unit}</span>}
                  </p>
                  <p className="mt-1.5 text-xs text-gray-400">{stat.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 md:grid-cols-2 mb-6">

              {/* Top สินค้า */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-0.5">{t("topProductsTitle")}</h3>
                <p className="text-xs text-gray-400 mb-5">{t("topProductsDesc")}</p>

                {topProducts.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">{t("noDataPeriod")}</p>
                ) : chartType === "table" ? (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 font-semibold">
                        <th className="text-left pb-2">{t("colProductName")}</th>
                        <th className="text-right pb-2 text-green-600">{t("colIn")}</th>
                        <th className="text-right pb-2 text-red-500">{t("colOut")}</th>
                        <th className="text-right pb-2">{t("colTotal")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {topProducts.map((p, i) => (
                        <tr key={i}>
                          <td className="py-2 font-semibold text-gray-800 truncate max-w-[140px]">{p.name}</td>
                          <td className="py-2 text-right font-bold text-green-600">{p.total_in ?? 0}</td>
                          <td className="py-2 text-right font-bold text-red-500">{p.total_out ?? 0}</td>
                          <td className="py-2 text-right font-black">{p.total_movements}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : chartType === "stacked" ? (
                  <div className="space-y-4">
                    {topProducts.map((p, i) => {
                      const total = (Number(p.total_in) + Number(p.total_out)) || 1;
                      const inPct = (Number(p.total_in) / total) * 100;
                      const outPct = (Number(p.total_out) / total) * 100;
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="font-semibold text-gray-800 truncate max-w-[200px]">{p.name}</span>
                            <span className="text-gray-400 shrink-0 ml-2">{p.total_movements} {t("cashTimes")}</span>
                          </div>
                          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                            <div className="bg-green-500 transition-all duration-500" style={{ width: `${inPct}%` }} />
                            <div className="bg-red-400 transition-all duration-500" style={{ width: `${outPct}%` }} />
                          </div>
                          <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                            <span className="text-green-600 font-semibold">{t("colIn")} {inPct.toFixed(0)}%</span>
                            <span className="text-red-500 font-semibold">{t("colOut")} {outPct.toFixed(0)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topProducts.map((p, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-semibold text-gray-800 truncate max-w-[200px]">{p.name}</span>
                          <span className="text-gray-400 font-mono shrink-0 ml-2">{p.total_movements} {t("cashTimes")}</span>
                        </div>
                        <div className="flex gap-1 h-2.5 rounded-full overflow-hidden bg-gray-100">
                          <div className="bg-green-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${(Number(p.total_in) / (Number(p.total_in) + Number(p.total_out) || 1)) * (Number(p.total_movements) / maxTopMovement) * 100}%` }} />
                          <div className="bg-red-400 h-full rounded-full transition-all duration-500"
                            style={{ width: `${(Number(p.total_out) / (Number(p.total_in) + Number(p.total_out) || 1)) * (Number(p.total_movements) / maxTopMovement) * 100}%` }} />
                        </div>
                        <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                          <span className="text-green-600 font-semibold">+{p.total_in ?? 0} {t("colIn")}</span>
                          <span className="text-red-500 font-semibold">-{p.total_out ?? 0} {t("colOut")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-4 text-xs text-gray-400 border-t border-gray-100 pt-3">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{t("colIn")}</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{t("colOut")}</span>
                </div>
              </div>

              {/* Daily Trend */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-0.5">{t("dailyTrendTitle")}</h3>
                <p className="text-xs text-gray-400 mb-5">{t("dailyTrendDesc")}</p>

                {dailyTrend.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">{t("noDataPeriod")}</p>
                ) : chartType === "table" ? (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 font-semibold">
                        <th className="text-left pb-2">{t("csvDate")}</th>
                        <th className="text-right pb-2 text-green-600">{t("colIn")}</th>
                        <th className="text-right pb-2 text-red-500">{t("colOut")}</th>
                        <th className="text-right pb-2">{t("csvNet")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {dailyTrend.map((d, i) => {
                        const net = Number(d.volume_in) - Number(d.volume_out);
                        return (
                          <tr key={i}>
                            <td className="py-2 text-gray-600">{new Date(d.date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</td>
                            <td className="py-2 text-right font-bold text-green-600">+{d.volume_in}</td>
                            <td className="py-2 text-right font-bold text-red-500">-{d.volume_out}</td>
                            <td className={`py-2 text-right font-black ${net >= 0 ? "text-green-600" : "text-red-500"}`}>{net >= 0 ? "+" : ""}{net}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : chartType === "stacked" ? (
                  <div className="space-y-2.5">
                    {dailyTrend.map((d, i) => {
                      const total = (Number(d.volume_in) + Number(d.volume_out)) || 1;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-14 shrink-0 text-right">
                            {new Date(d.date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                          </span>
                          <div className="flex flex-1 h-5 rounded-lg overflow-hidden bg-gray-100">
                            <div className="bg-green-500 flex items-center justify-end pr-1 transition-all"
                              style={{ width: `${(Number(d.volume_in) / total) * 100}%` }}>
                              {Number(d.volume_in) > 0 && <span className="text-[9px] text-white font-bold">{d.volume_in}</span>}
                            </div>
                            <div className="bg-red-400 flex items-center justify-start pl-1 transition-all"
                              style={{ width: `${(Number(d.volume_out) / total) * 100}%` }}>
                              {Number(d.volume_out) > 0 && <span className="text-[9px] text-white font-bold">{d.volume_out}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-end gap-2 h-32">
                    {dailyTrend.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex gap-0.5 items-end" style={{ height: "96px" }}>
                          <div className="flex-1 bg-green-500 rounded-t-md transition-all duration-500 min-h-[2px]"
                            style={{ height: `${(Number(d.volume_in) / maxDailyVolume) * 96}px` }} />
                          <div className="flex-1 bg-red-400 rounded-t-md transition-all duration-500 min-h-[2px]"
                            style={{ height: `${(Number(d.volume_out) / maxDailyVolume) * 96}px` }} />
                        </div>
                        <span className="text-[9px] text-gray-400">
                          {new Date(d.date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-4 text-xs text-gray-400 border-t border-gray-100 pt-3">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{t("colIn")}</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{t("colOut")}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
