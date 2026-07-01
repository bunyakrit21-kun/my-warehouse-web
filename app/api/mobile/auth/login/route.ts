import { NextResponse } from "next/server";
import sql from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Mobile admin login — returns token as JSON (not cookie)
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" }, { status: 400 });
    }

    const [user] = await sql`
      SELECT id, name, email, password, role, active
      FROM users WHERE email = ${email}
    `;

    if (!user || !user.active) {
      return NextResponse.json({ error: "ไม่พบบัญชีผู้ใช้นี้" }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }

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
