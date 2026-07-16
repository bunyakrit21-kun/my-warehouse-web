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
  const days = Math.min(Number(searchParams.get("days") ?? "7"), 42);

  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  const [shifts, entries, employees] = await Promise.all([
    sql`
      SELECT id, name, TO_CHAR(start_time,'HH24:MI') AS start_time,
             TO_CHAR(end_time,'HH24:MI') AS end_time, color, sort_order
      FROM shifts WHERE store_id = ${storeId}
      ORDER BY sort_order, start_time
    `,
    sql`
      SELECT se.id, se.work_date, se.shift_id, se.user_id, u.name AS user_name,
             se.checked_in_at, se.duty, u.duty AS user_duty
      FROM schedule_entries se
      JOIN users u ON u.id = se.user_id
      WHERE se.store_id = ${storeId}
        AND se.work_date >= ${weekStart}::date
        AND se.work_date < ${weekStart}::date + (${days} || ' days')::interval
    `,
    sql`
      SELECT id, name, duty FROM users
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

  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์จัดตารางเวร" }, { status: 403 });
  }

  const { storeId: bodyStoreId, workDate, shiftId, userId, duty } = await request.json();
  if (!workDate || !shiftId || !userId) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  const storeId = await resolveStoreId(user, bodyStoreId);
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  // หน้าที่ในเวรนี้: ถ้าไม่ส่งมา ใช้หน้าที่ประจำตัวพนักงาน (users.duty) เป็นค่าเริ่มต้น
  const [entry] = await sql`
    INSERT INTO schedule_entries (store_id, work_date, shift_id, user_id, duty)
    VALUES (${storeId}, ${workDate}, ${shiftId}, ${userId},
            COALESCE(${duty ?? null}, (SELECT duty FROM users WHERE id = ${userId})))
    ON CONFLICT (store_id, work_date, shift_id, user_id) DO NOTHING
    RETURNING id, duty
  `;
  return NextResponse.json({ success: true, id: entry?.id, duty: entry?.duty ?? null });
}

// PATCH — mark/unmark attendance
export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "ไม่มีสิทธิ์จัดตารางเวร" }, { status: 403 });
    }
    const { id, storeId: bodyStoreId, checkedIn, duty } = await request.json();
    const storeId = await resolveStoreId(user, bodyStoreId);
    if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

    if (duty !== undefined) {
      // แก้หน้าที่ของเวรนี้ (ครัว/หน้าบ้าน/กลาง ฯลฯ)
      await sql`
        UPDATE schedule_entries SET duty = ${duty || null}
        WHERE id = ${id} AND store_id = ${storeId}
      `;
    }
    if (checkedIn !== undefined) {
      const checkedInAt: Date | null = checkedIn ? new Date() : null;
      await sql`
        UPDATE schedule_entries SET checked_in_at = ${checkedInAt}
        WHERE id = ${id} AND store_id = ${storeId}
      `;
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// DELETE — remove assignment
export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์จัดตารางเวร" }, { status: 403 });
  }
  const { id, storeId: bodyStoreId } = await request.json();
  const storeId = await resolveStoreId(user, bodyStoreId);
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  await sql`DELETE FROM schedule_entries WHERE id = ${id} AND store_id = ${storeId}`;
  return NextResponse.json({ success: true });
}
