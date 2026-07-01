import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  try {
    const history = await sql`
      SELECT m.id, TO_CHAR(m.created_at, 'HH24:MI น.') as time, m.type,
             p.name as "itemName", m.qty, m.note,
             COALESCE(
               (SELECT name FROM users WHERE pin = m.employee_pin AND store_id = ${storeId} ORDER BY active DESC LIMIT 1),
               m.employee_pin
             ) as "user"
      FROM movements m
      LEFT JOIN products p ON p.id = m.product_id
      WHERE m.store_id = ${storeId}
      ORDER BY m.created_at DESC
      LIMIT 10
    `;
    return NextResponse.json(history);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
