import { NextResponse } from "next/server";
import sql from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(request: Request) {
  try {
    const { name, email, password, storeName, businessType, phone } = await request.json();

    if (!name || !email || !password || !storeName || !businessType || !phone) {
      return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบทุกช่อง" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
    }

    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: "อีเมลนี้ถูกใช้งานแล้ว" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // สร้าง user และ store พร้อมกัน
    const result = await sql.begin(async (sql) => {
      const [user] = await sql`
        INSERT INTO users (name, email, password, role, active)
        VALUES (${name}, ${email}, ${hashedPassword}, 'admin', true)
        RETURNING id, name, email, role
      `;

      const [store] = await sql`
        INSERT INTO stores (owner_id, name, business_type, phone)
        VALUES (${user.id}, ${storeName}, ${businessType}, ${phone})
        RETURNING id, name
      `;

      return { user, store };
    });

    // สร้าง token login อัตโนมัติหลัง signup
    const token = jwt.sign(
      { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    const response = NextResponse.json({ success: true }, { status: 201 });
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}