import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";

// GET /api/schedule?storeId=1&weekStart=2026-07-01
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("weekStart");
  if (!weekStart) return NextResponse.json({ error: "กรุณาระบุ weekStart" }, { status: 400 });

  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  const [shifts, entries, employees] = await Promise.all([
    sql`
      SELECT id, name, TO_CHAR(start_time,'HH24:MI') AS start_time, color, sort_order
      FROM shifts WHERE store_id = ${storeId}
      ORDER BY sort_order, start_time
    `,
    sql`
      SELECT se.id, se.work_date, se.shift_id, se.user_id, u.name AS user_name
      FROM schedule_entries se
      JOIN users u ON u.id = se.user_id
      WHERE se.store_id = ${storeId}
        AND se.work_date >= ${weekStart}::date
        AND se.work_date < ${weekStart}::date + interval '7 days'
    `,
    sql`
      SELECT id, name, pin FROM users
      WHERE store_id = ${storeId} AND active = true
      ORDER BY name
    `,
  ]);

  return NextResponse.json({ shifts, entries, employees });
}

// POST — assign employee to a shift+date
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId: bodyStoreId, workDate, shiftId, userId } = await request.json();
  if (!workDate || !shiftId || !userId) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  const storeId = await resolveStoreId(user, bodyStoreId);
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  const [entry] = await sql`
    INSERT INTO schedule_entries (store_id, work_date, shift_id, user_id)
    VALUES (${storeId}, ${workDate}, ${shiftId}, ${userId})
    ON CONFLICT (store_id, work_date, shift_id, user_id) DO NOTHING
    RETURNING id
  `;
  return NextResponse.json({ success: true, id: entry?.id });
}

// DELETE — remove assignment
export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, storeId: bodyStoreId } = await request.json();
  const storeId = await resolveStoreId(user, bodyStoreId);
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  await sql`DELETE FROM schedule_entries WHERE id = ${id} AND store_id = ${storeId}`;
  return NextResponse.json({ success: true });
}
