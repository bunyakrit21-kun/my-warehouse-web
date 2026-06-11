"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Product {
  id: string;
  barcode: string;
  name: string;
  zone: string;
  category: string;
  stock: number;
  unit: string;
  imageUrl?: string | null;
}

const INITIAL_PRODUCTS: Product[] = [
  { id: "PROD001", barcode: "8850123000001", name: "กระเทียมเจียว (蒜酥)", zone: "โซน 2 (กลางบ้าน)", category: "ของแห้งและเครื่องปรุง", stock: 5, unit: "แพ็ค" },
  { id: "PROD002", barcode: "8850123000002", name: "ถั่วลิสงคั่ว (烤花生)", zone: "โซน 2 (กลางบ้าน)", category: "ของแห้งและเครื่องปรุง", stock: 8, unit: "แพ็ค" },
  { id: "PROD003", barcode: "8850123000003", name: "ซอสหอย 蠔油 (主婦牌)", zone: "โซน 2 (กลางบ้าน)", category: "ของแห้งและเครื่องปรุง", stock: 1, unit: "แกลลอน" },
  { id: "PROD004", barcode: "8850123000004", name: "น้ำปลา 龍蝦魚露", zone: "โซน 2 (กลางบ้าน)", category: "ของแห้งและเครื่องปรุง", stock: 7, unit: "ขวด" },
  { id: "PROD005", barcode: "8850123000005", name: "น้ำปลาร้าแม่เหรียญ", zone: "โซน 2 (กลางบ้าน)", category: "ของแห้งและเครื่องปรุง", stock: 28, unit: "ขวด" },
  { id: "PROD006", barcode: "8850123000006", name: "รสดี 豬粉 (ROSDEE)", zone: "โซน 2 (กลางบ้าน)", category: "ของแห้งและเครื่องปรุง", stock: 10, unit: "ถุง" },
  { id: "PROD007", barcode: "8850123000007", name: "วุ้นเส้น 亨龍綠豆粉絲", zone: "โซน 2 (กลางบ้าน)", category: "เส้น แป้ง และนม", stock: 2, unit: "ถุงใหญ่" },
  { id: "PROD008", barcode: "8850123000008", name: "นมจืด 三花奶水", zone: "โซน 2 (กลางบ้าน)", category: "เส้น แป้ง และนม", stock: 6, unit: "กระป๋อง" },
  { id: "PROD009", barcode: "8850123000009", name: "กุ้งแห้ง (蝦米)", zone: "โซน 2 (กลางบ้าน)", category: "ของแห้งและเครื่องปรุง", stock: 0, unit: "斤" },
  { id: "PROD010", barcode: "8850123000010", name: "Coke (โค้ก)", zone: "โซน 3 (หน้าบ้าน)", category: "เครื่องดื่ม", stock: 24, unit: "กระป๋อง" },
  { id: "PROD011", barcode: "8850123000011", name: "กล่องข้าวดำ (黑色便當盒)", zone: "โซน 3 (หน้าบ้าน)", category: "บรรจุภัณฑ์", stock: 10, unit: "แพ็ค" },
  { id: "PROD012", barcode: "8850123000012", name: "ฝากล่องข้าวดำ", zone: "โซน 3 (หน้าบ้าน)", category: "บรรจุภัณฑ์", stock: 9, unit: "แพ็ค" },
  { id: "PROD013", barcode: "8850123000013", name: "ถุงขยะดำ/ฟ้า 76", zone: "โซน 3 (หน้าบ้าน)", category: "ทำความสะอาด", stock: 13, unit: "มัด" },
  { id: "PROD014", barcode: "8850123000014", name: "น้ำยาล้างจาน (洗碗精)", zone: "โซน 3 (หน้าบ้าน)", category: "ทำความสะอาด", stock: 1, unit: "แกลลอน" },
  { id: "PROD015", barcode: "8850123000015", name: "ทิชชู่ (衛生紙)", zone: "โซน 3 (หน้าบ้าน)", category: "บรรจุภัณฑ์", stock: 5, unit: "แพ็ค" },
  { id: "PROD016", barcode: "8850123000016", name: "น้ำยาล้างมือ (洗手乳)", zone: "โซน 3 (หน้าบ้าน)", category: "ห้องน้ำ", stock: 2, unit: "ขวด" },
  { id: "PROD017", barcode: "8850123000017", name: "น้ำหอมปรับอากาศ", zone: "โซน 3 (หน้าบ้าน)", category: "ห้องน้ำ", stock: 5, unit: "ชิ้น" },
];

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [search, setSearch] = useState("");
  
  const [statusFilter, setStatusFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // ฟอร์ม State เพิ่ม formImage สำหรับรูปภาพ
  const [formImage, setFormImage] = useState<string | null>(null);
  const [formBarcode, setFormBarcode] = useState("");
  const [formName, setFormName] = useState("");
  const [formZone, setFormZone] = useState("โซน 2 (กลางบ้าน)");
  const [formCategory, setFormCategory] = useState("ของแห้งและเครื่องปรุง");
  const [formStock, setFormStock] = useState("");
  const [formUnit, setFormUnit] = useState("ชิ้น");

  const getProductStatus = (stock: number) => {
    if (stock === 0) return "out";
    if (stock <= 5) return "low";
    return "normal";
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setFormImage(null);
    setFormBarcode("");
    setFormName("");
    setFormZone("โซน 2 (กลางบ้าน)");
    setFormCategory("ของแห้งและเครื่องปรุง");
    setFormStock("");
    setFormUnit("ชิ้น");
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormImage(product.imageUrl || null);
    setFormBarcode(product.barcode);
    setFormName(product.name);
    setFormZone(product.zone || "โซน 2 (กลางบ้าน)");
    setFormCategory(product.category);
    setFormStock(product.stock.toString());
    setFormUnit(product.unit);
    setIsModalOpen(true);
  };

  // จัดการอัปโหลดรูปภาพ (สร้าง Preview URL บน Browser)
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setFormImage(imageUrl);
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || formStock === "") return;

    const stockNumber = parseFloat(formStock) || 0;

    if (editingProduct) {
      setProducts(products.map((p) => 
        p.id === editingProduct.id 
          ? { ...p, barcode: formBarcode, name: formName, zone: formZone, category: formCategory, stock: stockNumber, unit: formUnit, imageUrl: formImage }
          : p
      ));
    } else {
      const newProduct: Product = {
        id: `PROD${String(products.length + 1).padStart(3, "0")}`,
        barcode: formBarcode || "-",
        name: formName,
        zone: formZone,
        category: formCategory,
        stock: stockNumber,
        unit: formUnit,
        imageUrl: formImage,
      };
      setProducts([...products, newProduct]);
    }

    setIsModalOpen(false);
  };

  const handleDeleteProduct = (id: string, name: string) => {
    if (confirm(`คุณต้องการลบรายการ "${name}" ออกจากคลังสินค้าใช่หรือไม่?`)) {
      setProducts(products.filter((p) => p.id !== id));
    }
  };

  const filteredProducts = products.filter((p) => {
    const currentStatus = getProductStatus(p.stock);
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
    const matchesStatus = statusFilter === "all" || currentStatus === statusFilter;
    const matchesZone = zoneFilter === "all" || p.zone === zoneFilter;
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesZone && matchesCategory;
  });

  const categoryOptions = formZone === "โซน 2 (กลางบ้าน)" 
    ? ["ของแห้งและเครื่องปรุง", "เส้น แป้ง และนม"]
    : ["เครื่องดื่ม", "บรรจุภัณฑ์", "ทำความสะอาด", "ห้องน้ำ"];

  return (
    <main className="min-h-screen bg-white text-black selection:bg-black selection:text-white">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-gray-300 bg-gray-50">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-gray-700" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 7.5 12 3l9 4.5-9 4.5L3 7.5Z" />
                <path d="M3 7.5V16.5L12 21l9-4.5V7.5" />
                <path d="M12 7.5V21" />
              </svg>
            </div>
            <div className="leading-tight">
              <p className="text-lg font-semibold tracking-tight">DiaM</p>
              <p className="text-xs text-gray-500">Smart Inventory System</p>
            </div>
          </div>
          <div>
            <Link href="/main" className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:border-black transition">
              กลับหน้าเริ่มต้น
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">คลังสต็อกสินค้า</h1>
            <p className="mt-1 text-sm text-gray-600">ตรวจสอบจำนวนสินค้าคงเหลือและสถานะ แยกตามโซนและหมวดหมู่</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium hover:border-black transition">
              Export CSV
            </button>
            <button 
              type="button" 
              onClick={openAddModal}
              className="rounded-2xl bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition"
            >
              + เพิ่มสินค้าใหม่
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="ค้นหาชื่อ หรือบาร์โค้ด..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black transition"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-black transition"
              >
                <option value="all">ทุกโซน</option>
                <option value="โซน 2 (กลางบ้าน)">โซน 2 (กลางบ้าน)</option>
                <option value="โซน 3 (หน้าบ้าน)">โซน 3 (หน้าบ้าน)</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-black transition max-w-[150px] truncate"
              >
                <option value="all">ทุกหมวดหมู่</option>
                <optgroup label="โซน 2">
                  <option value="ของแห้งและเครื่องปรุง">ของแห้งและเครื่องปรุง</option>
                  <option value="เส้น แป้ง และนม">เส้น แป้ง และนม</option>
                </optgroup>
                <optgroup label="โซน 3">
                  <option value="เครื่องดื่ม">เครื่องดื่ม</option>
                  <option value="บรรจุภัณฑ์">บรรจุภัณฑ์</option>
                  <option value="ทำความสะอาด">ทำความสะอาด</option>
                  <option value="ห้องน้ำ">ห้องน้ำ</option>
                </optgroup>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-black transition"
              >
                <option value="all">ทุกสถานะ</option>
                <option value="normal">ปกติ</option>
                <option value="low">ใกล้หมด</option>
                <option value="out">สินค้าหมด</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  <th className="px-6 py-4">รูปสินค้า</th>
                  <th className="px-6 py-4">ชื่อสินค้า</th>
                  <th className="px-6 py-4">โซน</th>
                  <th className="px-6 py-4">หมวดหมู่</th>
                  <th className="px-6 py-4 text-center">คงเหลือ</th>
                  <th className="px-6 py-4">หน่วย</th>
                  <th className="px-6 py-4">สถานะ</th>
                  <th className="px-6 py-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((p) => {
                    const currentStatus = getProductStatus(p.stock);
                    return (
                      <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{p.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5 tracking-wider">{p.barcode}</p>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-gray-600 font-medium text-xs">
                          {p.zone}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-gray-500 text-xs">
                          <span className="bg-gray-100 px-2 py-1 rounded-md">{p.category}</span>
                        </td>
                        <td className={`whitespace-nowrap px-6 py-4 text-center font-semibold text-base ${
                          currentStatus === "out" ? "text-red-500" : currentStatus === "low" ? "text-amber-600" : "text-gray-900"
                        }`}>{p.stock}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-gray-500 text-xs">{p.unit}</td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {currentStatus === "normal" && <span className="inline-flex rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-medium tracking-wide text-green-700">NORMAL</span>}
                          {currentStatus === "low" && <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-medium tracking-wide text-amber-700">LOW STOCK</span>}
                          {currentStatus === "out" && <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-medium tracking-wide text-red-700">OUT</span>}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-center">
                          <button 
                            type="button" 
                            onClick={() => openEditModal(p)}
                            className="text-xs font-medium text-gray-600 hover:text-black mr-4 transition"
                          >
                            Edit
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="text-xs font-medium text-red-400 hover:text-red-600 transition"
                          >
                            Del
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-400">ไม่พบข้อมูลสินค้าที่ค้นหา</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-6 py-4 text-xs text-gray-500">
            <p>แสดงผล <span className="font-medium text-gray-900">{filteredProducts.length}</span> จากทั้งหมด <span className="font-medium text-gray-900">{products.length}</span> รายการ</p>
          </div>
        </div>
      </section>

      {/* TECH-MINIMALIST MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-sm font-semibold tracking-tight text-black">
                {editingProduct ? "EDIT PRODUCT" : "NEW PRODUCT"}
              </h2>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-black transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-5">
              
              {/* Image Upload Zone */}
              <div>
                <label className="text-[10px] font-mono text-gray-400 block mb-2 tracking-widest">PRODUCT IMAGE</label>
                <div className="relative group flex items-center justify-center w-full h-32 border border-dashed border-gray-300 bg-gray-50 rounded-xl overflow-hidden hover:border-gray-500 hover:bg-gray-100 transition-all cursor-pointer">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageChange} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                  {formImage ? (
                    <img src={formImage} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                      <span className="text-[10px] font-medium font-mono tracking-widest">UPLOAD IMAGE</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-gray-400 block mb-1.5 tracking-widest">PRODUCT NAME</label>
                <input
                  type="text"
                  placeholder="ระบุชื่อวัตถุดิบหรือสินค้า"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 py-2.5 px-3 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black transition bg-gray-50 focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-mono text-gray-400 block mb-1.5 tracking-widest">ZONE</label>
                  <select
                    value={formZone}
                    onChange={(e) => {
                      setFormZone(e.target.value);
                      if (e.target.value === "โซน 2 (กลางบ้าน)") setFormCategory("ของแห้งและเครื่องปรุง");
                      else setFormCategory("บรรจุภัณฑ์");
                    }}
                    className="w-full rounded-xl border border-gray-200 py-2.5 px-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black transition bg-gray-50 focus:bg-white"
                  >
                    <option value="โซน 2 (กลางบ้าน)">โซน 2</option>
                    <option value="โซน 3 (หน้าบ้าน)">โซน 3</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-gray-400 block mb-1.5 tracking-widest">CATEGORY</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 py-2.5 px-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black transition bg-gray-50 focus:bg-white"
                  >
                    {categoryOptions.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-mono text-gray-400 block mb-1.5 tracking-widest">STOCK QTY</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 py-2.5 px-3 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black transition bg-gray-50 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-gray-400 block mb-1.5 tracking-widest">UNIT</label>
                  <input
                    type="text"
                    placeholder="เช่น แพ็ค, ขวด"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 py-2.5 px-3 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black transition bg-gray-50 focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-gray-400 block mb-1.5 tracking-widest">BARCODE</label>
                <input
                  type="text"
                  placeholder="เช่น 8850123456781 (Optional)"
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 py-2.5 px-3 text-sm font-mono outline-none focus:border-black focus:ring-1 focus:ring-black transition bg-gray-50 focus:bg-white"
                />
              </div>

              <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-black transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-black px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 shadow-lg shadow-black/20 transition-all active:scale-95"
                >
                  {editingProduct ? "Save Changes" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}