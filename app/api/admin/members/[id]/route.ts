import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  try {
    const body = await request.json();

    if (body.pin !== undefined) {
      if (!/^\d{4}$/.test(body.pin)) {
        return NextResponse.json({ error: "PIN ต้องเป็นตัวเลข 4 หลัก" }, { status: 400 });
      }
      // ตรวจสอบว่า PIN ซ้ำกับคนอื่นในร้านเดียวกันไหม
      const [target] = await sql`SELECT store_id FROM users WHERE id = ${id} AND active = true`;
      if (!target) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });

      const dup = await sql`
        SELECT id FROM users
        WHERE pin = ${body.pin} AND store_id = ${target.store_id} AND active = true AND id != ${id}
      `;
      if (dup.length > 0) return NextResponse.json({ error: "PIN นี้ถูกใช้งานแล้วในร้านนี้" }, { status: 400 });

      await sql`UPDATE users SET pin = ${body.pin} WHERE id = ${id}`;
    }

    if (body.name !== undefined) {
      if (!body.name.trim()) return NextResponse.json({ error: "ชื่อไม่ถูกต้อง" }, { status: 400 });
      await sql`UPDATE users SET name = ${body.name.trim()} WHERE id = ${id}`;
    }

    if (body.role !== undefined) {
      const allowed = ["staff", "manager", "admin"];
      if (!allowed.includes(body.role)) return NextResponse.json({ error: "role ไม่ถูกต้อง" }, { status: 400 });
      await sql`UPDATE users SET role = ${body.role} WHERE id = ${id}`;
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  try {
    await sql`UPDATE users SET active = false WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
