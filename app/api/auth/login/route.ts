import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { verifyEmailPassword } from "@/lib/passwordAuth";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

const MAX_ATTEMPTS_PER_IP = 20;
const IP_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  try {
    if (isRateLimited(`login:${getClientIp(request)}`, MAX_ATTEMPTS_PER_IP, IP_WINDOW_MS)) {
      return NextResponse.json({ error: "มีการพยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง" }, { status: 429 });
    }

    const { email, password, remember } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" }, { status: 400 });
    }

    const result = await verifyEmailPassword(email, password);

    if (!result.ok) {
      if (result.reason === "locked") {
        return NextResponse.json(
          { error: `ลองรหัสผ่านผิดหลายครั้งเกินไป กรุณาลองใหม่ในอีก ${result.retryAfterMinutes} นาที` },
          { status: 429 }
        );
      }
      // ข้อความเดียวกันทั้งกรณีไม่พบอีเมลและรหัสผ่านผิด — ไม่เปิดเผยว่าอีเมลไหนมีในระบบ
      return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }
    const user = result.user;

    const maxAgeSeconds = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: maxAgeSeconds }
    );

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });

    // เก็บ token ใน httpOnly cookie — จำเครื่อง 30 วัน, ปกติ 7 วัน
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
