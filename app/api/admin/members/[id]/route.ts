import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser } from "@/lib/auth";
import { hashPin, findUserByPin } from "@/lib/pin";

// พนักงานที่จัดการได้ต้องอยู่ในร้านที่ผู้เรียก (admin) เป็นเจ้าของเท่านั้น —
// กันไม่ให้เจ้าของร้าน A ไปแก้/ลบ/รีเซ็ต PIN ของพนักงานร้าน B ด้วยการเดา id
async function assertOwnsMember(callerId: number, memberId: string): Promise<{ store_id: number } | null> {
  const [target] = await sql`SELECT store_id FROM users WHERE id = ${memberId} AND active = true`;
  if (!target || target.store_id == null) return null;
  const [store] = await sql`SELECT id FROM stores WHERE id = ${target.store_id} AND owner_id = ${callerId}`;
  return store ? { store_id: target.store_id } : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  try {
    const target = await assertOwnsMember(user.id, id);
    if (!target) return NextResponse.json({ error: "ไม่พบสมาชิก หรือไม่มีสิทธิ์จัดการ" }, { status: 403 });

    const body = await request.json();

    if (body.pin !== undefined) {
      if (!/^\d{4}$/.test(body.pin)) {
        return NextResponse.json({ error: "PIN ต้องเป็นตัวเลข 4 หลัก" }, { status: 400 });
      }
      const dup = await findUserByPin(target.store_id, body.pin);
      if (dup && dup.id !== Number(id)) {
        return NextResponse.json({ error: "PIN นี้ถูกใช้งานแล้วในร้านนี้" }, { status: 400 });
      }
      const hashedPin = await hashPin(body.pin);
      await sql`UPDATE users SET pin = ${hashedPin} WHERE id = ${id}`;
    }

    if (body.name !== undefined) {
      if (!body.name.trim()) return NextResponse.json({ error: "ชื่อไม่ถูกต้อง" }, { status: 400 });
      await sql`UPDATE users SET name = ${body.name.trim()} WHERE id = ${id}`;
    }

    if (body.duty !== undefined) {
      // หน้าที่ประจำตัว เช่น ครัว / หน้าบ้าน / กลาง — เป็นค่าเริ่มต้นเวลาใส่ชื่อลงตารางเวร
      await sql`UPDATE users SET duty = ${body.duty || null} WHERE id = ${id}`;
    }

    if (body.role !== undefined) {
      // พนักงานในร้านเป็นได้แค่ staff/manager — "admin" คือเจ้าของร้าน สร้างผ่านการสมัครเท่านั้น
      const allowed = ["staff", "manager"];
      if (!allowed.includes(body.role)) return NextResponse.json({ error: "role ไม่ถูกต้อง (staff หรือ manager)" }, { status: 400 });
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
    const target = await assertOwnsMember(user.id, id);
    if (!target) return NextResponse.json({ error: "ไม่พบสมาชิก หรือไม่มีสิทธิ์จัดการ" }, { status: 403 });

    await sql`UPDATE users SET active = false WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
