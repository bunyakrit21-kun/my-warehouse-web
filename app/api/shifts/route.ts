import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  const shifts = await sql`
    SELECT id, name, TO_CHAR(start_time, 'HH24:MI') AS start_time, color, sort_order
    FROM shifts WHERE store_id = ${storeId}
    ORDER BY sort_order, start_time
  `;
  return NextResponse.json(shifts);
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, startTime, color, storeId: bodyStoreId } = await request.json();
  if (!name || !startTime) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  const storeId = await resolveStoreId(user, bodyStoreId);
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  const [maxOrder] = await sql`SELECT COALESCE(MAX(sort_order),0) AS m FROM shifts WHERE store_id = ${storeId}`;
  const [shift] = await sql`
    INSERT INTO shifts (store_id, name, start_time, color, sort_order)
    VALUES (${storeId}, ${name}, ${startTime}, ${color ?? "blue"}, ${Number(maxOrder.m) + 1})
    RETURNING id, name, TO_CHAR(start_time,'HH24:MI') AS start_time, color, sort_order
  `;
  return NextResponse.json(shift, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, storeId: bodyStoreId } = await request.json();
  const storeId = await resolveStoreId(user, bodyStoreId);
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  await sql`DELETE FROM shifts WHERE id = ${id} AND store_id = ${storeId}`;
  return NextResponse.json({ success: true });
}
