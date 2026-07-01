import { NextResponse } from "next/server";
import sql from "@/lib/db";
import jwt from "jsonwebtoken";

export async function POST(request: Request) {
  try {
    const { storeName, pin, remember } = await request.json();

    if (!storeName || !pin) {
      return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

    // หา user ที่มี PIN นี้ และเป็นสมาชิกของร้านที่ระบุ
    const [user] = await sql`
      SELECT u.id, u.name, u.role, u.pin, u.store_id
      FROM users u
      JOIN stores s ON s.id = u.store_id
      WHERE u.pin = ${pin} AND u.active = true AND s.name = ${storeName}
    `;

    if (!user) {
      return NextResponse.json({ error: "PIN หรือชื่อร้านไม่ถูกต้อง" }, { status: 401 });
    }

    const [store] = await sql`
      SELECT id, name FROM stores WHERE id = ${user.store_id}
    `;

    if (!store) {
      return NextResponse.json({ error: "ไม่พบร้านนี้ในระบบ" }, { status: 404 });
    }

    const maxAgeSeconds = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12;

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role, storeId: store.id, storeName: store.name, type: "staff" },
      process.env.JWT_SECRET!,
      { expiresIn: maxAgeSeconds }
    );

    const response = NextResponse.json({
      success: true,
      user: { name: user.name, role: user.role, storeName: store.name },
    });

    // จำเครื่อง 30 วัน, ปกติ 12 ชั่วโมง
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: maxAgeSeconds,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}