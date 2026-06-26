/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

export default function InventoryPage() {
  const router = useRouter();
  const { t } = useT();
  const [products, setProducts] = useState<Product[]>([]);
  const [storeId, setStoreId] = useState("");
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<string>("ALL");

  const [zonesList, setZonesList] = useState<string[]>([]);
  const [categoriesList, setCategoriesList] = useState<string[]>([]);

  const [showAddZoneInput, setShowAddZoneInput] = useState(false);
  const [newZoneName, setNewZoneName] = useState("");
  const [showAddCatInput, setShowAddCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState("");

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [authPin, setAuthPin] = useState("");
  const [authError, setAuthError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [zone, setZone] = useState("");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [unit, setUnit] = useState("แพ็ค");
  const [imageFile, setImageFile] = useState("");

  const [formCreatorPin, setFormCreatorPin] = useState("");
  const [formPinError, setFormPinError] = useState("");
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);

  const fetchProductsFromDatabase = async (sid: string) => {
    if (!sid) return;
    try {
      const res = await fetch(`/api/products?storeId=${sid}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
        const uniqueZones = Array.from(new Set(data.map((p: Product) => p.zone).filter(Boolean))) as string[];
        const uniqueCats = Array.from(new Set(data.map((p: Product) => p.category).filter(Boolean))) as string[];
        setZonesList(uniqueZones);
        setCategoriesList(uniqueCats);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  };

  useEffect(() => {
    setMounted(true);
    async function init() {
      const meData = await fetch("/api/auth/me").then(r => r.ok ? r.json() : null);
      const user = meData?.user;
      if (!user) { router.push("/login"); return; }
      const sid = user.type === "staff"
        ? String(user.storeId)
        : new URLSearchParams(window.location.search).get("storeId") ?? "";
      setStoreId(sid);
      await fetchProductsFromDatabase(sid);
    }
    init();
  }, []);

  if (!mounted) return <div className="p-8 text-center text-sm font-sans text-gray-400">กำลังเชื่อมต่อฐานข้อมูลเซิร์ฟเวอร์...</div>;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") setImageFile(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddNewZone = () => {
    const trimmed = newZoneName.trim();
    if (!trimmed) return;
    if (zonesList.includes(trimmed)) return alert("มีรายชื่อโซนนี้อยู่ในระบบแล้ว");
    setZonesList([...zonesList, trimmed]);
    setZone(trimmed);
    setNewZoneName("");
    setShowAddZoneInput(false);
  };

  const handleAddNewCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    if (categoriesList.includes(trimmed)) return alert("มีรายชื่อหมวดหมู่นี้อยู่ในระบบแล้ว");
    setCategoriesList([...categoriesList, trimmed]);
    setCategory(trimmed);
    setNewCatName("");
    setShowAddCatInput(false);
  };

  const filteredProducts = products.filter((p: Product) => {
    if (filterMode !== "ALL" && filterMode !== "LOW_STOCK" && filterMode !== "OUT_OF_STOCK" && p.zone !== filterMode) return false;
    if (filterMode === "OUT_OF_STOCK" && p.stock !== 0) return false;
    if (filterMode === "LOW_STOCK" && !(p.stock > 0 && p.stock <= p.minStock)) return false;
    const searchText = search.toLowerCase().trim();
    return p.name.toLowerCase().includes(searchText) || p.id.toLowerCase().includes(searchText);
  });

  const countTotal = products.length;
  const outOfStockItems = products.filter((p: Product) => p.stock === 0).length;
  const lowStockItems = products.filter((p: Product) => p.stock > 0 && p.stock <= p.minStock).length;

  const openCreateModal = () => {
    setEditingId(null); setName(""); setStock(""); setMinStock(""); setUnit("แพ็ค");
    setZone(zonesList[0] || ""); setCategory(categoriesList[0] || "");
    setImageFile(""); setFormCreatorPin(""); setFormPinError(""); setIsFormModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product); setAuthPin(""); setAuthError(""); setAuthMode("EDIT"); setIsAuthModalOpen(true);
  };

  const openDeleteModal = (product: Product) => {
    setSelectedProduct(product); setAuthPin(""); setAuthError(""); setAuthMode("DELETE"); setIsAuthModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const verifyRes = await fetch("/api/employees/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: formCreatorPin }),
    });
    if (!verifyRes.ok) {
      setFormPinError("รหัสพนักงานไม่ถูกต้อง ไม่มีสิทธิ์ทำรายการบันทึก");
      return;
    }

    if (editingId) {
      const response = await fetch(`/api/products/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), category, zone,
          stock: Number(stock) || 0,
          minStock: Number(minStock) || 0,
          unit: unit.trim(),
          image: imageFile,
        }),
      });
      if (response.ok) {
        alert("แก้ไขสินค้าสำเร็จ");
        setIsFormModalOpen(false);
        fetchProductsFromDatabase(storeId);
      } else {
        alert("แก้ไขไม่สำเร็จ");
      }
    } else {
      const maxIdNum = products.reduce((max, p) => {
        const currentIdNum = parseInt(p.id.replace("PROD", ""), 10);
        return currentIdNum > max ? currentIdNum : max;
      }, 0);
      const nextId = `PROD${String(maxIdNum + 1).padStart(3, "0")}`;

      try {
        const response = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: nextId,
            name: name.trim(),
            category, zone,
            stock: Number(stock) || 0,
            minStock: Number(minStock) || 0,
            unit: unit.trim(),
            image: imageFile,
            storeId,
          }),
        });
        if (response.ok) {
          alert("📢 บันทึกสินค้าใหม่ลงสู่คลาวด์สำเร็จ!");
          setIsFormModalOpen(false);
          fetchProductsFromDatabase(storeId);
        } else {
          alert("เกิดข้อผิดพลาดจากฝั่งเซิร์ฟเวอร์ ไม่สามารถบันทึกได้");
        }
      } catch (err) {
        console.error("Insert product API Error:", err);
      }
    }
  };

  const handleAuthVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    const verifyRes = await fetch("/api/employees/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: authPin }),
    });

    if (verifyRes.ok) {
      setIsAuthModalOpen(false);
      if (authMode === "DELETE" && selectedProduct) {
        try {
          const res = await fetch(`/api/products/${selectedProduct.id}`, { method: "DELETE" });
          if (res.ok) {
            alert("ลบสินค้าสำเร็จ");
            fetchProductsFromDatabase(storeId);
          } else {
            alert("ลบไม่สำเร็จ");
          }
        } catch {
          alert("เกิดข้อผิดพลาด");
        }
      } else if (authMode === "EDIT" && selectedProduct) {
        setEditingId(selectedProduct.id);
        setName(selectedProduct.name);
        setCategory(selectedProduct.category);
        setZone(selectedProduct.zone);
        setStock(String(selectedProduct.stock));
        setMinStock(String(selectedProduct.minStock));
        setUnit(selectedProduct.unit);
        setImageFile(selectedProduct.image);
        setFormCreatorPin("");
        setFormPinError("");
        setIsFormModalOpen(true);
      }
    } else {
      setAuthError("รหัสพนักงานไม่ถูกต้อง หรือไม่มีสิทธิ์สำหรับการดำเนินการนี้");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 text-black font-sans antialiased pb-12">

      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-gray-300 bg-gray-50 text-gray-700 shadow-inner">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="leading-tight">
              <p className="text-lg font-bold tracking-tight">DiaM Dashboard</p>
              <p className="text-xs text-gray-400 font-medium">ระบบคลังสินค้าฐานข้อมูลกลาง (Cloud Connected)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LangSwitcher />
            <button onClick={() => { window.location.href = "/dashboard"; }} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:border-black transition-all">{t("backToHome")}</button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">

        {/* Filter Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          <button type="button" onClick={() => setFilterMode("ALL")} className={`text-left rounded-2xl border bg-white p-4 shadow-sm transition-all ${filterMode === "ALL" ? "border-black ring-2 ring-black/5" : "border-gray-200 hover:border-gray-400"}`}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t("allItems")}</p>
            <p className="mt-0.5 text-xl font-black text-gray-900">{countTotal}</p>
          </button>

          {zonesList.map((zoneName) => (
            <button key={zoneName} type="button" onClick={() => setFilterMode(zoneName)}
              className={`text-left rounded-2xl border bg-white p-4 shadow-sm transition-all ${filterMode === zoneName ? "border-black ring-2 ring-black/5" : "border-gray-200 hover:border-gray-400"}`}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">{zoneName}</p>
              <p className="mt-0.5 text-xl font-black text-gray-900">{products.filter(p => p.zone === zoneName).length} ชิ้น</p>
            </button>
          ))}

          <button type="button" onClick={() => setFilterMode("LOW_STOCK")}
            className={`text-left rounded-2xl border bg-white p-4 shadow-sm border-l-4 border-l-orange-500 transition-all ${filterMode === "LOW_STOCK" ? "border-black ring-2 ring-black/5" : "border-gray-200 hover:border-gray-400"}`}>
            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">{t("lowStock")}</p>
            <p className="mt-0.5 text-xl font-black text-orange-600">{lowStockItems}</p>
          </button>

          <button type="button" onClick={() => setFilterMode("OUT_OF_STOCK")}
            className={`text-left rounded-2xl border bg-white p-4 shadow-sm border-l-4 border-l-red-500 transition-all ${filterMode === "OUT_OF_STOCK" ? "border-black ring-2 ring-black/5" : "border-gray-200 hover:border-gray-400"}`}>
            <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">{t("outOfStock")}</p>
            <p className="mt-0.5 text-xl font-black text-red-600">{outOfStockItems}</p>
          </button>
        </div>

        {/* Search & Add */}
        <div className="mb-6 flex gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input type="text" placeholder="พิมพ์คำค้นหาชื่อสินค้าหรือรหัสสินค้า..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium outline-none focus:border-black focus:ring-2 focus:ring-gray-100 shadow-sm transition-all" />
          </div>
          <button type="button" onClick={openCreateModal} className="rounded-2xl bg-black text-white px-6 font-bold text-sm hover:bg-gray-800 transition-all shadow-sm shrink-0 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            {t("addProduct")}
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  <th className="px-5 py-4 w-24 text-center">{t("colImage")}</th>
                  <th className="px-5 py-4">{t("colIdName")}</th>
                  <th className="px-5 py-4">{t("colCatZone")}</th>
                  <th className="px-5 py-4 text-center w-48">{t("colStockQty")}</th>
                  <th className="px-5 py-4 text-right w-44">{t("colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredProducts.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-sm text-gray-400 font-medium">{t("emptyInventory")}</td></tr>
                ) : (
                  filteredProducts.map((p: Product) => {
                    let ringColor = "border-gray-200";
                    let borderHighlightStyle = "border-l-0";
                    if (Number(p.stock) === 0) {
                      ringColor = "border-red-400 ring-2 ring-red-100 ring-offset-1";
                      borderHighlightStyle = "border-l-4 border-l-red-500 bg-red-50/5 hover:bg-red-50/15";
                    } else if (Number(p.stock) <= Number(p.minStock)) {
                      ringColor = "border-orange-400 ring-2 ring-orange-100/50";
                      borderHighlightStyle = "border-l-4 border-l-orange-500 bg-orange-50/5 hover:bg-orange-50/15";
                    } else {
                      borderHighlightStyle = "hover:bg-gray-50/50";
                    }
                    return (
                      <tr key={p.id} className={`transition-all duration-150 ${borderHighlightStyle}`}>
                        <td className="whitespace-nowrap px-5 py-4 flex justify-center">
                          {p.image ? (
                            <button type="button" onClick={() => setActiveLightboxImg(p.image)} className={`group relative block h-12 w-12 overflow-hidden rounded-xl border bg-gray-50 transition-all hover:scale-105 active:scale-95 ${ringColor}`}>
                              <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                            </button>
                          ) : (
                            <button type="button" onClick={() => router.push(`/dashboard/movement?productId=${p.id}&type=MOVE_IN&storeId=${storeId}`)} className={`group relative flex flex-col items-center justify-center h-12 w-12 rounded-xl border bg-gray-50 text-gray-400 text-center font-bold transition-all hover:scale-105 hover:bg-gray-100 hover:text-black ${ringColor}`}>
                              <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                              <span className="text-[10px] text-gray-700 group-hover:text-black font-black">{p.stock}</span>
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-[10px] text-gray-400 font-bold tracking-wide">{p.id}</div>
                          <div className="font-bold text-gray-900 leading-tight text-sm">{p.name}</div>
                          <div className="text-[10px] text-gray-400 font-medium mt-0.5">ลงบันทึกคลาวด์เมื่อ: {p.createdAt}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-xs font-bold text-gray-800">{p.category}</div>
                          <div className="text-[11px] font-medium text-gray-400 mt-0.5">{p.zone}</div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" onClick={() => router.push(`/dashboard/movement?productId=${p.id}&type=MOVE_OUT&storeId=${storeId}`)} disabled={Number(p.stock) <= 0} className="w-7 h-7 rounded-lg border border-gray-200 bg-white flex items-center justify-center font-bold text-gray-500 hover:border-black hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm">-</button>
                            <div className="text-sm font-black text-gray-900 min-w-[50px]">{p.stock} <span className="text-xs font-medium text-gray-400 block font-normal">{p.unit}</span></div>
                            <button type="button" onClick={() => router.push(`/dashboard/movement?productId=${p.id}&type=MOVE_IN&storeId=${storeId}`)} className="w-7 h-7 rounded-lg border border-gray-200 bg-white flex items-center justify-center font-bold text-gray-500 hover:border-black hover:text-black transition shadow-sm">+</button>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => openEditModal(p)} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:border-black transition-all shadow-sm">แก้ไข</button>
                            <button onClick={() => openDeleteModal(p)} className="rounded-lg border border-red-100 bg-red-50/80 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm">ลบข้อมูล</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* MODAL FORM */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col font-sans">
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between bg-gray-50/80 shrink-0">
              <h2 className="text-sm font-bold text-gray-800 tracking-tight">
                {editingId ? t("editProductTitle") : t("addProductTitle")}
              </h2>
              <button type="button" onClick={() => setIsFormModalOpen(false)} className="text-gray-400 hover:text-black">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 overflow-y-auto flex-1 text-sm">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">{t("productNameLabel")}</label>
                <input type="text" placeholder={t("productNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm outline-none focus:border-black focus:bg-white transition-all font-sans" required />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-500">{t("zoneLabel")}</label>
                  <button type="button" onClick={() => setShowAddZoneInput(!showAddZoneInput)} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                    {showAddZoneInput ? t("cancel") : t("addNewZone")}
                  </button>
                </div>
                {showAddZoneInput && (
                  <div className="flex gap-2 mb-2">
                    <input type="text" placeholder="ระบุชื่อโซนใหม่" value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} className="flex-1 rounded-xl border border-blue-300 bg-white py-1.5 px-3 text-xs outline-none font-sans" />
                    <button type="button" onClick={handleAddNewZone} className="rounded-xl bg-blue-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-blue-700">ยืนยัน</button>
                  </div>
                )}
                {zonesList.length > 0 ? (
                  <select value={zone} onChange={(e) => setZone(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm font-medium outline-none focus:border-black focus:bg-white transition-all font-sans">
                    {zonesList.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                ) : (
                  <input type="text" placeholder="กด + เพิ่มโซนใหม่ก่อน" value={zone} onChange={(e) => setZone(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm outline-none focus:border-black focus:bg-white transition-all font-sans" />
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-500">{t("categoryLabel")}</label>
                  <button type="button" onClick={() => setShowAddCatInput(!showAddCatInput)} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                    {showAddCatInput ? t("cancel") : t("addNewCat")}
                  </button>
                </div>
                {showAddCatInput && (
                  <div className="flex gap-2 mb-2">
                    <input type="text" placeholder="ระบุหมวดใหม่" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="flex-1 rounded-xl border border-blue-300 bg-white py-1.5 px-3 text-xs outline-none font-sans" />
                    <button type="button" onClick={handleAddNewCategory} className="rounded-xl bg-blue-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-blue-700">ยืนยัน</button>
                  </div>
                )}
                {categoriesList.length > 0 ? (
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm font-medium outline-none focus:border-black focus:bg-white transition-all font-sans">
                    {categoriesList.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input type="text" placeholder="กด + เพิ่มหมวดหมู่ใหม่ก่อน" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm outline-none focus:border-black focus:bg-white transition-all font-sans" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">{t("initialStock")}</label>
                  <input type="number" min="0" placeholder="0" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm text-center outline-none focus:border-black focus:bg-white transition-all font-sans" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">{t("unitLabel")}</label>
                  <input type="text" placeholder={t("unitPlaceholder")} value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm text-center outline-none focus:border-black focus:bg-white transition-all font-sans" required />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">{t("minStockLabel")}</label>
                <input type="number" min="0" placeholder="เกณฑ์แจ้งเตือนสต็อกขั้นต่ำเมื่อของขาด" value={minStock} onChange={(e) => setMinStock(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm outline-none focus:border-black focus:bg-white transition-all font-sans" />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1.5">{t("photoLabel")}</label>
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-2">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-black file:text-white hover:file:bg-gray-800 cursor-pointer font-sans" />
                </div>
                {imageFile && (
                  <div className="mt-2 relative w-14 h-14 border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
                    <img src={imageFile} alt="Preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setImageFile("")} className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold">ลบรูป</button>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-dashed border-gray-200 bg-red-50/30 p-4 rounded-2xl border border-red-100">
                <label className="text-xs font-bold text-red-600 block mb-1.5">{t("pinConfirmLabel")}</label>
                <input type="password" maxLength={4} inputMode="numeric" placeholder={t("pinConfirmPlaceholder")} value={formCreatorPin} onChange={(e) => { setFormCreatorPin(e.target.value.replace(/\D/g, "")); setFormPinError(""); }} className="w-full rounded-xl border border-red-200 bg-white py-2.5 px-4 text-center font-sans font-bold tracking-widest text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all placeholder:tracking-normal placeholder:font-normal placeholder:text-gray-400" required />
                {formPinError && <p className="text-xs text-red-600 font-bold mt-2 text-center">{formPinError}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4 shrink-0 font-sans">
                <button type="button" onClick={() => setIsFormModalOpen(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-400 hover:text-black">{t("cancel")}</button>
                <button type="submit" className="rounded-xl bg-black text-white px-5 py-2 text-sm font-bold hover:bg-gray-800 shadow-sm">
                  {editingId ? t("saveEdit") : t("saveCreate")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUTHENTICATION MODAL */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl p-6 text-center font-sans">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3 border border-red-100">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 15v2m0-6h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-base font-bold text-gray-900">{t("authModalTitle")}</h3>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{t("authModalDesc")}</p>
            <form onSubmit={handleAuthVerification} className="mt-4 space-y-3">
              <input type="password" maxLength={4} placeholder="••••" inputMode="numeric" value={authPin} onChange={(e) => setAuthPin(e.target.value.replace(/\D/g, ""))} className="w-28 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-center text-sm font-bold tracking-widest focus:bg-white focus:border-black outline-none transition-all font-sans" required />
              {authError && <p className="text-xs text-red-600 font-bold bg-red-50 py-1.5 px-2 rounded-xl border border-red-100">{authError}</p>}
              <div className="flex gap-2 justify-center pt-3 text-xs font-bold">
                <button type="button" onClick={() => setIsAuthModalOpen(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-gray-400 hover:border-black">{t("cancel")}</button>
                <button type="submit" className="rounded-xl bg-red-600 text-white px-4 py-2 hover:bg-red-700 shadow-sm">{t("confirmPin")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {activeLightboxImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={() => setActiveLightboxImg(null)}>
          <div className="relative max-w-3xl max-h-[85vh] p-2 bg-white rounded-3xl shadow-2xl m-4" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setActiveLightboxImg(null)} className="absolute -top-3 -right-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black text-white shadow-lg hover:bg-gray-800">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="overflow-hidden rounded-2xl bg-gray-50">
              <img src={activeLightboxImg} alt="วัตถุดิบ" className="max-w-full max-h-[75vh] object-contain block mx-auto" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}