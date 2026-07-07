import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  try {
    const [existing] = await sql`SELECT store_id FROM accounts WHERE id = ${id} AND archived_at IS NULL`;
    if (!existing) return NextResponse.json({ error: "ไม่พบบัญชี" }, { status: 404 });

    const storeId = await resolveStoreId(user, String(existing.store_id));
    if (!storeId) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงร้านนี้" }, { status: 403 });

    const { name } = await request.json();
    if (!name) return NextResponse.json({ error: "กรุณาระบุชื่อบัญชี" }, { status: 400 });

    await sql`UPDATE accounts SET name = ${name} WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// DELETE = archive (soft delete). Refuses to archive the store's only default-cash account.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  try {
    const [existing] = await sql`SELECT store_id, is_default_cash FROM accounts WHERE id = ${id} AND archived_at IS NULL`;
    if (!existing) return NextResponse.json({ error: "ไม่พบบัญชี" }, { status: 404 });

    const storeId = await resolveStoreId(user, String(existing.store_id));
    if (!storeId) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงร้านนี้" }, { status: 403 });

    if (existing.is_default_cash) {
      return NextResponse.json({ error: "ไม่สามารถลบบัญชีเงินสดหลักได้ ต้องมีอย่างน้อย 1 บัญชีเสมอ" }, { status: 400 });
    }

    await sql`UPDATE accounts SET archived_at = now() WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
