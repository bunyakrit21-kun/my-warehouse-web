import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";

// System categories can be renamed but not deleted; custom categories can be both.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  try {
    const [existing] = await sql`SELECT store_id FROM transaction_categories WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: "ไม่พบหมวดหมู่" }, { status: 404 });

    const storeId = await resolveStoreId(user, String(existing.store_id));
    if (!storeId) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงร้านนี้" }, { status: 403 });

    const { name, icon } = await request.json();
    if (!name) return NextResponse.json({ error: "กรุณาระบุชื่อหมวดหมู่" }, { status: 400 });

    if (icon) {
      await sql`UPDATE transaction_categories SET name = ${name}, icon = ${icon} WHERE id = ${id}`;
    } else {
      await sql`UPDATE transaction_categories SET name = ${name} WHERE id = ${id}`;
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  try {
    const [existing] = await sql`SELECT store_id, is_system FROM transaction_categories WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: "ไม่พบหมวดหมู่" }, { status: 404 });

    const storeId = await resolveStoreId(user, String(existing.store_id));
    if (!storeId) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงร้านนี้" }, { status: 403 });

    if (existing.is_system) {
      return NextResponse.json({ error: "ไม่สามารถลบหมวดหมู่ของระบบได้" }, { status: 400 });
    }

    await sql`DELETE FROM transaction_categories WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
