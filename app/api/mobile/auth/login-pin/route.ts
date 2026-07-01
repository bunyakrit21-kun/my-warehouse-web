import { NextResponse } from "next/server";
import sql from "@/lib/db";
import jwt from "jsonwebtoken";

// Mobile staff login — returns token as JSON (not cookie)
export async function POST(request: Request) {
  try {
    const { storeName, pin } = await request.json();

    if (!storeName || !pin) {
      return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

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

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role, storeId: store.id, storeName: store.name, type: "staff" },
      process.env.JWT_SECRET!,
      { expiresIn: "12h" }
    );

    return NextResponse.json({
      token,
      user: { name: user.name, role: user.role, storeId: store.id, storeName: store.name },
    });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
