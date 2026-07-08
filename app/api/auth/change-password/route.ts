import { NextResponse } from "next/server";
import sql from "@/lib/db";
import bcrypt from "bcryptjs";
import { getUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }
    // กติกาเดียวกับตอนสมัครสมาชิก — จะได้เปลี่ยนเป็นรหัสที่อ่อนกว่าไม่ได้
    if (newPassword.length < 8 || !/\d/.test(newPassword)) {
      return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษรและมีตัวเลขอย่างน้อย 1 ตัว" }, { status: 400 });
    }

    const [row] = await sql`SELECT password FROM users WHERE id = ${user.id} AND active = true`;
    if (!row) return NextResponse.json({ error: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });

    const isMatch = await bcrypt.compare(currentPassword, row.password);
    if (!isMatch) return NextResponse.json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, { status: 400 });

    const hashed = await bcrypt.hash(newPassword, 10);
    await sql`UPDATE users SET password = ${hashed} WHERE id = ${user.id}`;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
