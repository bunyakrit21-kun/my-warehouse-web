"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useT, LangSwitcher } from "@/lib/i18n";
import PinBoxes from "@/components/PinBoxes";

interface Store {
  id: number;
  name: string;
  business_type: string;
  phone: string;
  business_day_start_time: string | null;
  business_day_end_time: string | null;
  logo_thumbnail: string | null;
}

interface Member {
  id: number;
  name: string;
  role: string;
}

export default function StoresPage() {
  const router = useRouter();
  const { t } = useT();

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [editName, setEditName] = useState("");
  const [editBusinessType, setEditBusinessType] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editStartTime, setEditStartTime] = useState("00:00");
  const [editEndTime, setEditEndTime] = useState("00:00");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoChanged, setLogoChanged] = useState<string | null>(null);
  const [savingStore, setSavingStore] = useState(false);
  const [storeMsg, setStoreMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState(["", "", "", ""]);
  const [newRole, setNewRole] = useState("staff");
  const [customRole, setCustomRole] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState("");

  // PIN reset inline state: memberId → new PIN being typed
  const [pinResetId, setPinResetId] = useState<number | null>(null);
  const [pinResetValue, setPinResetValue] = useState(["", "", "", ""]);
  const [pinResetMsg, setPinResetMsg] = useState<{ id: number; type: "ok" | "err"; text: string } | null>(null);
  const [savingPin, setSavingPin] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchStores(); }, []);
  useEffect(() => { if (selectedStoreId) fetchMembers(selectedStoreId); }, [selectedStoreId]);

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
    setEditStartTime(s.business_day_start_time?.slice(0, 5) ?? "00:00");
    setEditEndTime(s.business_day_end_time?.slice(0, 5) ?? "00:00");
    setLogoPreview(s.logo_thumbnail ?? null);
    setLogoChanged(null);
    setStoreMsg(null);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== "string") return;
      const img = new Image();
      img.onload = () => {
        const maxDim = 600;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL("image/jpeg", 0.8);
        setLogoPreview(dataUri);
        setLogoChanged(dataUri);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const fetchMembers = async (storeId: number) => {
    const res = await fetch(`/api/admin/members?storeId=${storeId}`);
    const data = await res.json();
    setMembers(data);
  };

  const handleSelectStore = (s: Store) => {
    setSelectedStoreId(s.id);
    applyStoreToForm(s);
    setPinResetId(null);
    setPinResetMsg(null);
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId) return;
    setSavingStore(true);
    setStoreMsg(null);
    const res = await fetch(`/api/stores/${selectedStoreId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName, business_type: editBusinessType, phone: editPhone,
        businessDayStartTime: editStartTime, businessDayEndTime: editEndTime,
        ...(logoChanged !== null ? { logo: logoChanged } : {}),
      }),
    });
    setSavingStore(false);
    if (res.ok) {
      setStoreMsg({ type: "ok", text: t("profileSaved") });
      fetchStores();
    } else {
      setStoreMsg({ type: "err", text: t("error") });
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError("");
    if (!selectedStoreId) return;
    if (newPin.join("").length !== 4) return setMemberError(t("alertPinRequired"));
    const roleToSave = newRole === "other" ? customRole.trim() : newRole;
    if (!roleToSave) return setMemberError("กรุณาระบุตำแหน่ง");
    setAddingMember(true);
    const res = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, pin: newPin.join(""), role: roleToSave, storeId: selectedStoreId }),
    });
    const data = await res.json();
    setAddingMember(false);
    if (!res.ok) return setMemberError(data.error);
    setNewName(""); setNewPin(["", "", "", ""]); setNewRole("staff"); setCustomRole("");
    fetchMembers(selectedStoreId);
  };

  const handleDeleteMember = async (id: number, memberName: string) => {
    if (!confirm(t("confirmDeleteMember").replace("%s", memberName))) return;
    await fetch(`/api/admin/members/${id}`, { method: "DELETE" });
    if (selectedStoreId) fetchMembers(selectedStoreId);
  };

  const handleResetPin = async (id: number) => {
    if (pinResetValue.join("").length !== 4) {
      setPinResetMsg({ id, type: "err", text: t("alertPinRequired") });
      return;
    }
    setSavingPin(true);
    const res = await fetch(`/api/admin/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pinResetValue.join("") }),
    });
    const data = await res.json();
    setSavingPin(false);
    if (res.ok) {
      setPinResetMsg({ id, type: "ok", text: t("pinChanged") });
      setPinResetId(null);
      setPinResetValue(["", "", "", ""]);
    } else {
      setPinResetMsg({ id, type: "err", text: data.error ?? t("error") });
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">{t("loading")}</div>;

  const currentStore = stores.find(s => s.id === selectedStoreId);

  const ROLE_LABEL: Record<string, string> = {
    admin: t("roleAdmin"),
    manager: t("roleManager"),
    staff: t("roleStaff"),
  };

  return (
    <main className="min-h-screen bg-gray-50 font-sans antialiased pb-16">
      <header className="border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/dashboard")}
              className="grid h-9 w-9 place-items-center rounded-xl border border-gray-200 hover:border-black transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-base font-bold text-gray-900">{t("manageStoresTitle")}</h1>
          </div>
          <LangSwitcher />
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-8 space-y-6">

        {/* Store switcher */}
        {stores.length > 1 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{t("selectStoreSwitcher")}</p>
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
          <div className="grid md:grid-cols-5 gap-6">

            {/* Store info — left column (2/5) */}
            <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 h-fit">
              <h2 className="text-sm font-bold text-gray-800 mb-5">{t("storeDetails")}</h2>
              <form onSubmit={handleSaveStore} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{t("storeLogoLabel")}</label>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 border border-gray-200 overflow-hidden shrink-0 grid place-items-center">
                      {logoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoPreview} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-300 text-xl">🏪</span>
                      )}
                    </div>
                    <input type="file" accept="image/*" onChange={handleLogoUpload}
                      className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-black file:text-white hover:file:bg-gray-800 cursor-pointer font-sans" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{t("storeNameShort")}</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-black focus:bg-white transition-all" required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{t("businessType")}</label>
                  <input type="text" value={editBusinessType} onChange={e => setEditBusinessType(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-black focus:bg-white transition-all" required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{t("phone")}</label>
                  <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-black focus:bg-white transition-all" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{t("businessHoursLabel")}</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-gray-400 block mb-1">{t("businessDayStart")}</label>
                      <input type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-black focus:bg-white transition-all" />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 block mb-1">{t("businessDayEnd")}</label>
                      <input type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-black focus:bg-white transition-all" />
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">{t("businessHoursHelp")}</p>
                </div>

                {storeMsg && (
                  <p className={`text-xs font-semibold px-3 py-2 rounded-xl ${storeMsg.type === "ok" ? "text-green-700 bg-green-50 border border-green-100" : "text-red-600 bg-red-50 border border-red-100"}`}>
                    {storeMsg.type === "ok" ? "✓ " : "✕ "}{storeMsg.text}
                  </p>
                )}

                <button type="submit" disabled={savingStore}
                  className="w-full rounded-xl bg-black text-white py-2.5 text-sm font-semibold hover:bg-gray-800 disabled:bg-gray-300 transition-all">
                  {savingStore ? t("saving") : t("saveStore")}
                </button>
              </form>
            </div>

            {/* Team — right column (3/5) */}
            <div className="md:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-bold text-gray-800">{t("teamSection")}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{currentStore.name}</p>
                </div>
                <span className="text-xs font-bold text-gray-400">{members.length} {t("person")}</span>
              </div>

              {/* Add member form */}
              <form onSubmit={handleAddMember} className="flex flex-col gap-2 mb-5">
                <input type="text" placeholder={t("memberNamePH")} value={newName} onChange={e => setNewName(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-black focus:bg-white transition-all" required />
                <select
                  value={newRole}
                  onChange={e => { setNewRole(e.target.value); setCustomRole(""); }}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-black focus:bg-white transition-all"
                >
                  <option value="staff">{t("roleStaff")}</option>
                  <option value="manager">{t("roleManager")}</option>
                  <option value="other">อื่นๆ...</option>
                </select>
                {newRole === "other" && (
                  <input
                    type="text"
                    placeholder="ระบุตำแหน่ง เช่น ครัว, แคชเชียร์, ส่งของ..."
                    value={customRole}
                    onChange={e => setCustomRole(e.target.value)}
                    autoFocus
                    className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-black focus:bg-white transition-all"
                    required
                  />
                )}
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 text-center mb-3">PIN พนักงาน</p>
                  <PinBoxes value={newPin} onChange={setNewPin} />
                </div>
                <button type="submit" disabled={addingMember}
                  className="rounded-xl bg-black text-white text-sm font-semibold py-2.5 hover:bg-gray-800 disabled:bg-gray-300 transition-all">
                  {addingMember ? t("addingMemberStatus") : `+ ${t("addMemberBtn")}`}
                </button>
              </form>
              {memberError && (
                <p className="text-xs text-red-600 font-semibold mb-4 bg-red-50 px-4 py-2 rounded-xl">{memberError}</p>
              )}

              {/* Member list */}
              {members.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">{t("noMembers")}</div>
              ) : (
                <div className="space-y-2">
                  {members.map(m => (
                    <div key={m.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded-lg bg-white border border-gray-200 text-xs font-black text-gray-700">
                            {m.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                            <p className="text-xs text-gray-400">{ROLE_LABEL[m.role] ?? m.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setPinResetId(pinResetId === m.id ? null : m.id);
                              setPinResetValue(["", "", "", ""]);
                              setPinResetMsg(null);
                            }}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-100 bg-blue-50 px-2.5 py-1 rounded-lg transition-all">
                            {t("resetPin")}
                          </button>
                          <button onClick={() => handleDeleteMember(m.id, m.name)}
                            className="text-xs font-semibold text-red-500 hover:text-red-700 border border-red-100 bg-red-50 px-2.5 py-1 rounded-lg transition-all">
                            {t("del")}
                          </button>
                        </div>
                      </div>

                      {/* Inline PIN reset */}
                      {pinResetId === m.id && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs font-semibold text-gray-500 text-center mb-3">PIN ใหม่สำหรับ {m.name}</p>
                          <PinBoxes value={pinResetValue} onChange={v => { setPinResetValue(v); setPinResetMsg(null); }} />
                          {pinResetMsg?.id === m.id && (
                            <p className={`text-xs font-semibold text-center mt-2 ${pinResetMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
                              {pinResetMsg.text}
                            </p>
                          )}
                          <div className="flex items-center justify-center gap-2 mt-3">
                            <button
                              onClick={() => handleResetPin(m.id)}
                              disabled={savingPin || pinResetValue.join("").length !== 4}
                              className="rounded-xl bg-black text-white text-sm font-semibold px-6 py-2 hover:bg-gray-800 disabled:bg-gray-300 transition-all">
                              {savingPin ? "..." : t("confirm")}
                            </button>
                            <button onClick={() => { setPinResetId(null); setPinResetMsg(null); }}
                              className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2">{t("cancel")}</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </section>
    </main>
  );
}
