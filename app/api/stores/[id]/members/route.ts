import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [store] = await sql`SELECT owner_id FROM stores WHERE id = ${id}`;
  if (!store || store.owner_id !== user.id) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  try {
    const members = await sql`
      SELECT sm.id, sm.role, sm.joined_at, u.name, u.email
      FROM store_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.store_id = ${id}
      ORDER BY sm.joined_at ASC
    `;
    return NextResponse.json(members);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [store] = await sql`SELECT owner_id FROM stores WHERE id = ${id}`;
  if (!store || store.owner_id !== user.id) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์จัดการร้านนี้" }, { status: 403 });
  }

  try {
    const { email, role } = await request.json();
    const [targetUser] = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (!targetUser) return NextResponse.json({ error: "ไม่พบผู้ใช้นี้ในระบบ" }, { status: 404 });

    await sql`
      INSERT INTO store_members (store_id, user_id, role)
      VALUES (${id}, ${targetUser.id}, ${role ?? "staff"})
      ON CONFLICT (store_id, user_id) DO UPDATE SET role = EXCLUDED.role
    `;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [store] = await sql`SELECT owner_id FROM stores WHERE id = ${id}`;
  if (!store || store.owner_id !== user.id) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");
    if (!memberId) return NextResponse.json({ error: "ต้องระบุ memberId" }, { status: 400 });

    await sql`DELETE FROM store_members WHERE id = ${memberId} AND store_id = ${id}`;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
