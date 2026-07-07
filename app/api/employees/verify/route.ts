import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { verifyStorePin } from "@/lib/pin";

export async function POST(request: Request) {
  const loggedIn = await getUser();
  if (!loggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { pin, storeId } = await request.json();

    if (!pin || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 400 });
    }

    if (!storeId) {
      return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });
    }

    const result = await verifyStorePin(storeId, pin);

    if (!result.ok) {
      if (result.reason === "locked") {
        const mins = Math.ceil(result.retryAfterSeconds / 60);
        return NextResponse.json({ error: `ใส่ PIN ผิดหลายครั้งเกินไป กรุณาลองใหม่ในอีก ${mins} นาที` }, { status: 429 });
      }
      return NextResponse.json({ error: "ไม่พบรหัสพนักงานนี้" }, { status: 404 });
    }

    return NextResponse.json({ name: result.user.name, role: result.user.role });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
