import { NextResponse } from "next/server";
import sql from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getUser, STEPUP_COOKIE, STEPUP_MAX_AGE_SECONDS } from "@/lib/auth";
import { isRateLimited } from "@/lib/rateLimit";

// Re-confirms the already-logged-in admin's login password before granting access
// to /dashboard/accounting for 15 minutes (spec-07 section 6.1). Only meaningful for
// admins — the proxy + role checks already keep staff/PIN sessions out entirely.
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  if (isRateLimited(`stepup:${user.id}`, 5, 5 * 60 * 1000)) {
    return NextResponse.json({ error: "ลองยืนยันตัวตนผิดหลายครั้งเกินไป กรุณาลองใหม่ในอีกสักครู่" }, { status: 429 });
  }

  try {
    const { password } = await request.json();
    if (!password) return NextResponse.json({ error: "กรุณากรอกรหัสผ่าน" }, { status: 400 });

    const [row] = await sql`SELECT password FROM users WHERE id = ${user.id} AND active = true`;
    if (!row) return NextResponse.json({ error: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });

    const isMatch = await bcrypt.compare(password, row.password);
    if (!isMatch) return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });

    const stepupToken = jwt.sign({ uid: user.id }, process.env.JWT_SECRET!, { expiresIn: STEPUP_MAX_AGE_SECONDS });

    const response = NextResponse.json({ success: true });
    response.cookies.set(STEPUP_COOKIE, stepupToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: STEPUP_MAX_AGE_SECONDS,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
