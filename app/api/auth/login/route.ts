import { NextResponse } from "next/server";
import sql from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const MAX_PASSWORD_ATTEMPTS = 5;
const PASSWORD_LOCKOUT_MINUTES = 5;

export async function POST(request: Request) {
  try {
    const { email, password, remember } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" }, { status: 400 });
    }

    const [user] = await sql`
      SELECT id, name, email, password, role, active, failed_password_attempts, password_locked_until
      FROM users
      WHERE email = ${email}
    `;

    if (!user || !user.active) {
      return NextResponse.json({ error: "ไม่พบบัญชีผู้ใช้นี้" }, { status: 401 });
    }

    if (user.password_locked_until && new Date(user.password_locked_until) > new Date()) {
      const mins = Math.ceil((new Date(user.password_locked_until).getTime() - Date.now()) / 60000);
      return NextResponse.json({ error: `ลองรหัสผ่านผิดหลายครั้งเกินไป กรุณาลองใหม่ในอีก ${mins} นาที` }, { status: 429 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const [updated] = await sql`
        UPDATE users SET failed_password_attempts = failed_password_attempts + 1 WHERE id = ${user.id}
        RETURNING failed_password_attempts
      `;
      if (updated.failed_password_attempts >= MAX_PASSWORD_ATTEMPTS) {
        await sql`
          UPDATE users SET failed_password_attempts = 0,
            password_locked_until = now() + make_interval(mins => ${PASSWORD_LOCKOUT_MINUTES})
          WHERE id = ${user.id}
        `;
      }
      return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }

    if (user.failed_password_attempts > 0 || user.password_locked_until) {
      await sql`UPDATE users SET failed_password_attempts = 0, password_locked_until = NULL WHERE id = ${user.id}`;
    }

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