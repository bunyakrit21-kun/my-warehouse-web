"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Store {
  id: number;
  name: string;
  business_type: string;
  phone: string;
}

interface Member {
  id: number;
  name: string;
  role: string;
  pin: string;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "แอดมิน",
  manager: "ผู้จัดการ",
  staff: "พนักงาน",
};

export default function StoresPage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [editName, setEditName] = useState("");
  const [editBusinessType, setEditBusinessType] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingStore, setSavingStore] = useState(false);

  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newRole, setNewRole] = useState("staff");
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState("");

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedStoreId) fetchMembers(selectedStoreId);
  }, [selectedStoreId]);

  const fetchStores = async () => {
    const res = await fetch("/api/stores");
    const data = await res.json();
    setStores(data);
    if (data.length > 0) {
      setSelectedStoreId(data[0].id);
      applyStoreToForm(data[0]);
    }
    setLoading(false);
  };

  const applyStoreToForm = (s: Store) => {
    setEditName(s.name);
    setEditBusinessType(s.business_type);
    setEditPhone(s.phone ?? "");
  };

  const fetchMembers = async (storeId: number) => {
    const res = await fetch(`/api/admin/members?storeId=${storeId}`);
    const data = await res.json();
    setMembers(data);
  };

  const handleSelectStore = (s: Store) => {
    setSelectedStoreId(s.id);
    applyStoreToForm(s);
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId) return;
    setSavingStore(true);
    await fetch(`/api/stores/${selectedStoreId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, business_type: editBusinessType, phone: editPhone }),
    });
    setSavingStore(false);
    fetchStores();
    alert("บันทึกข้อมูลร้านสำเร็จ");
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError("");
    if (!selectedStoreId) return;
    if (!/^\d{4}$/.test(newPin)) return setMemberError("PIN ต้องเป็นตัวเลข 4 หลัก");
    setAddingMember(true);
    const res = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, pin: newPin, role: newRole, storeId: selectedStoreId }),
    });
    const data = await res.json();
    setAddingMember(false);
    if (!res.ok) return setMemberError(data.error);
    setNewName(""); setNewPin(""); setNewRole("staff");
    fetchMembers(selectedStoreId);
  };

  const handleDeleteMember = async (id: number, name: string) => {
    if (!confirm(`ลบ "${name}" ออกจากทีมงาน?`)) return;
    await fetch(`/api/admin/members/${id}`, { method: "DELETE" });
    if (selectedStoreId) fetchMembers(selectedStoreId);
  };

  if (loading) return <div className="p-8 text-center text-gray-400">กำลังโหลด...</div>;

  const currentStore = stores.find(s => s.id === selectedStoreId);

  return (
    <main className="min-h-screen bg-gray-50 font-sans antialiased pb-12">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <h1 className="text-lg font-bold">จัดการร้านและทีมงาน</h1>
          <button onClick={() => router.push("/dashboard")}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold hover:border-black transition-all">
            กลับหน้าหลัก
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-8 space-y-8">

        {/* เลือกร้าน */}
        {stores.length > 1 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">เลือกร้านที่ต้องการจัดการ</p>
            <div className="flex gap-2 flex-wrap">
              {stores.map(s => (
                <button key={s.id} onClick={() => handleSelectStore(s)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${selectedStoreId === s.id ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStore && (
          <>
            {/* ข้อมูลร้าน */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-800 mb-5">ข้อมูลร้านค้า</h2>
              <form onSubmit={handleSaveStore} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">ชื่อร้าน</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-black focus:bg-white transition-all" required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">ประเภทธุรกิจ</label>
                  <input type="text" value={editBusinessType} onChange={e => setEditBusinessType(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-black focus:bg-white transition-all" required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">เบอร์โทร</label>
                  <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-black focus:bg-white transition-all" />
                </div>
                <button type="submit" disabled={savingStore}
                  className="rounded-xl bg-black text-white px-6 py-2.5 text-sm font-semibold hover:bg-gray-800 disabled:bg-gray-300 transition-all">
                  {savingStore ? "กำลังบันทึก..." : "บันทึกข้อมูลร้าน"}
                </button>
              </form>
            </div>

            {/* ทีมงาน */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-800 mb-1">ทีมงาน</h2>
              <p className="text-xs text-gray-400 mb-5">พนักงานของร้าน {currentStore.name}</p>

              <form onSubmit={handleAddMember} className="grid sm:grid-cols-4 gap-3 mb-6">
                <input type="text" placeholder="ชื่อพนักงาน" value={newName} onChange={e => setNewName(e.target.value)}
                  className="sm:col-span-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-black" required />
                <select value={newRole} onChange={e => setNewRole(e.target.value)}
                  className="sm:col-span-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-black">
                  <option value="staff">พนักงาน</option>
                  <option value="manager">ผู้จัดการ</option>
                </select>
                <input type="password" inputMode="numeric" maxLength={4} placeholder="PIN 4 หลัก"
                  value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))}
                  className="sm:col-span-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-center tracking-widest outline-none focus:border-black" required />
                <button type="submit" disabled={addingMember}
                  className="sm:col-span-1 rounded-xl bg-black text-white text-sm font-semibold py-2.5 hover:bg-gray-800 disabled:bg-gray-300 transition-all">
                  {addingMember ? "กำลังเพิ่ม..." : "เพิ่มพนักงาน"}
                </button>
              </form>
              {memberError && <p className="text-xs text-red-600 font-semibold mb-4 bg-red-50 px-4 py-2 rounded-xl">{memberError}</p>}

              <div className="overflow-hidden rounded-2xl border border-gray-200">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      <th className="px-6 py-4">ชื่อ</th>
                      <th className="px-6 py-4">ตำแหน่ง</th>
                      <th className="px-6 py-4">PIN</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {members.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">ยังไม่มีพนักงานในร้านนี้</td></tr>
                    ) : (
                      members.map(m => (
                        <tr key={m.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4 font-semibold text-gray-900">{m.name}</td>
                          <td className="px-6 py-4 text-xs text-gray-500">{ROLE_LABEL[m.role] ?? m.role}</td>
                          <td className="px-6 py-4 font-mono text-gray-400">••••</td>
                          <td className="px-6 py-4">
                            <button onClick={() => handleDeleteMember(m.id, m.name)}
                              className="text-xs text-red-500 hover:text-red-700 font-semibold">ลบ</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}