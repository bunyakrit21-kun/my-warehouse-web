import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import sql from "@/lib/db";
import type { JWTPayload } from "@/lib/auth";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    if (isRateLimited(`refresh:${getClientIp(request)}`, 30, 15 * 60 * 1000)) {
      return NextResponse.json({ error: "มีการเรียกใช้บ่อยเกินไป กรุณาลองใหม่ภายหลัง" }, { status: 429 });
    }

    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: "กรุณาส่ง token" }, { status: 400 });
    }

    let payload: JWTPayload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    } catch (err) {
      const expired = err instanceof Error && err.name === "TokenExpiredError";
      return NextResponse.json(
        { error: expired ? "token หมดอายุแล้ว กรุณา login ใหม่" : "token ไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    // เช็คกับ DB ว่า user ยังมีตัวตนและ active อยู่ — ไม่งั้นพนักงานที่ถูกปิดบัญชี
    // จะต่ออายุ token ของตัวเองได้เรื่อยๆ ไม่มีวันหลุดจากระบบ
    const [user] = await sql`SELECT active FROM users WHERE id = ${payload.id}`;
    if (!user || !user.active) {
      return NextResponse.json({ error: "บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลร้าน" }, { status: 401 });
    }

    // ลบ jwt meta fields ออก แล้วออก token ใหม่
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { iat: _iat, exp: _exp, ...claims } = payload;
    const newToken = jwt.sign(claims, process.env.JWT_SECRET!, { expiresIn: "7d" });

    return NextResponse.json({ token: newToken });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
