import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // resolveStoreId ignores its requestedStoreId argument for staff-type tokens (it always
  // returns the caller's own store), so it must be checked against the requested id, not
  // just for truthiness — otherwise a request for someone else's store id would silently
  // and confusingly return the caller's own store instead of a clean 403.
  const storeId = await resolveStoreId(user, id);
  if (!storeId || String(storeId) !== id) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงร้านนี้" }, { status: 403 });
  }

  const [store] = await sql`SELECT id, name, business_type, phone, country FROM stores WHERE id = ${storeId}`;
  if (!store) return NextResponse.json({ error: "ไม่พบร้าน" }, { status: 404 });
  return NextResponse.json(store);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [store] = await sql`SELECT owner_id FROM stores WHERE id = ${id}`;
  if (!store || store.owner_id !== user.id) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์จัดการร้านนี้" }, { status: 403 });
  }

  try {
    const { name, business_type, phone } = await request.json();
    await sql`
      UPDATE stores SET name = ${name}, business_type = ${business_type}, phone = ${phone}
      WHERE id = ${id}
    `;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
