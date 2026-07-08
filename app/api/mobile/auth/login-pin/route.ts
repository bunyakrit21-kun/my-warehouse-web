import { NextResponse } from "next/server";
import sql from "@/lib/db";
import jwt from "jsonwebtoken";
import { verifyStoreNameAndPin } from "@/lib/pin";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

// Mobile staff login — returns token as JSON (not cookie)
export async function POST(request: Request) {
  try {
    if (isRateLimited(`login-pin:${getClientIp(request)}`, 20, 15 * 60 * 1000)) {
      return NextResponse.json({ error: "มีการพยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง" }, { status: 429 });
    }

    const { storeName, pin } = await request.json();

    if (!storeName || !pin) {
      return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

    const result = await verifyStoreNameAndPin(storeName, pin);

    if (!result.ok) {
      if (result.reason === "locked") {
        const mins = Math.ceil(result.retryAfterSeconds / 60);
        return NextResponse.json({ error: `ใส่ PIN ผิดหลายครั้งเกินไป กรุณาลองใหม่ในอีก ${mins} นาที` }, { status: 429 });
      }
      return NextResponse.json({ error: "PIN หรือชื่อร้านไม่ถูกต้อง" }, { status: 401 });
    }
    const user = result.user;

    const [store] = await sql`
      SELECT id, name FROM stores WHERE id = ${user.storeId}
    `;

    if (!store) {
      return NextResponse.json({ error: "ไม่พบร้านนี้ในระบบ" }, { status: 404 });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role, storeId: store.id, storeName: store.name, type: "staff" },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    return NextResponse.json({
      token,
      user: { name: user.name, role: user.role, storeId: store.id, storeName: store.name },
    });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
