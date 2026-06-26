import { NextResponse } from "next/server";
import sql from "@/lib/db";
import jwt from "jsonwebtoken";

export async function POST(request: Request) {
  try {
    const { storeName, pin } = await request.json();

    if (!storeName || !pin) {
      return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

    // หา user ที่มี PIN นี้
    const [user] = await sql`
      SELECT u.id, u.name, u.role, u.pin
      FROM users u
      WHERE u.pin = ${pin} AND u.active = true
    `;

    if (!user) {
      return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
    }

    // หา store ที่ตรงกับชื่อ
    const [store] = await sql`
      SELECT id, name FROM stores WHERE name = ${storeName}
    `;

    if (!store) {
      return NextResponse.json({ error: "ไม่พบร้านนี้ในระบบ" }, { status: 404 });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role, storeId: store.id, storeName: store.name, type: "staff" },
      process.env.JWT_SECRET!,
      { expiresIn: "12h" }
    );

    const response = NextResponse.json({
      success: true,
      user: { name: user.name, role: user.role, storeName: store.name },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}