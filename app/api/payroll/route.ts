import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";

// รายการงวดเงินเดือน (admin เท่านั้น — เป็นเรื่องเจ้าของร้าน)
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "manager") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  const periods = await sql`
    SELECT p.id, p.name, TO_CHAR(p.start_date,'YYYY-MM-DD') AS "startDate",
           TO_CHAR(p.end_date,'YYYY-MM-DD') AS "endDate", p.tip_pool AS "tipPool",
           p.status, p.paid_at AS "paidAt", p.created_at AS "createdAt",
           COALESCE((SELECT SUM(base_pay) FROM payroll_lines l WHERE l.period_id = p.id), 0) AS "totalBase",
           COALESCE((SELECT SUM(tip_amount) FROM payroll_lines l WHERE l.period_id = p.id), 0) AS "totalTip"
    FROM payroll_periods p
    WHERE p.store_id = ${storeId}
    ORDER BY p.start_date DESC, p.id DESC
  `;
  return NextResponse.json(periods);
}

// สร้างงวดใหม่
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "manager") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  try {
    const { storeId: bodyStoreId, name, startDate, endDate, tipPool } = await request.json();
    const storeId = await resolveStoreId(user, bodyStoreId);
    if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });
    if (!name?.trim() || !startDate || !endDate) {
      return NextResponse.json({ error: "กรุณากรอกชื่องวดและช่วงวันที่" }, { status: 400 });
    }
    const DATE = /^\d{4}-\d{2}-\d{2}$/;
    if (!DATE.test(startDate) || !DATE.test(endDate) || endDate < startDate) {
      return NextResponse.json({ error: "ช่วงวันที่ไม่ถูกต้อง" }, { status: 400 });
    }

    const [period] = await sql`
      INSERT INTO payroll_periods (store_id, name, start_date, end_date, tip_pool, created_by)
      VALUES (${storeId}, ${name.trim()}, ${startDate}::date, ${endDate}::date, ${Number(tipPool) || 0}, ${user.id})
      RETURNING id
    `;
    return NextResponse.json({ success: true, id: period.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
