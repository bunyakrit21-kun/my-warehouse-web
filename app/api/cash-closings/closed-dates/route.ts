import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";

// GET — which (shift, date) pairs already have a cash closing, for the schedule page's badge.
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "กรุณาระบุช่วงวันที่" }, { status: 400 });

  try {
    const rows = await sql`
      SELECT DISTINCT shift_id as "shiftId", business_date as "businessDate"
      FROM cash_closings
      WHERE store_id = ${storeId} AND business_date BETWEEN ${from}::date AND ${to}::date
        AND shift_id IS NOT NULL
    `;
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
