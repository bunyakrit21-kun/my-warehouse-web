import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { verifyEmailPassword } from "@/lib/passwordAuth";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

const MAX_ATTEMPTS_PER_IP = 20;
const IP_WINDOW_MS = 15 * 60 * 1000;

// Mobile admin login — returns token as JSON (not cookie).
// Uses the same verifyEmailPassword as web login so the lockout
// protection can't be bypassed by switching endpoints.
export async function POST(request: Request) {
  try {
    if (isRateLimited(`login:${getClientIp(request)}`, MAX_ATTEMPTS_PER_IP, IP_WINDOW_MS)) {
      return NextResponse.json({ error: "มีการพยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง" }, { status: 429 });
    }

    const { email, password } = await request.json();

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
      return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }
    const user = result.user;

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
