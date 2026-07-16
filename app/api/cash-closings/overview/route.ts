import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";

/**
 * ภาพรวมปิดยอดรายเดือน จัดกลุ่มตาม "วันทำการ" (business_date ไม่ใช่เวลาที่กดบันทึก
 * — ปิดหลังเที่ยงคืนก็ยังเกาะวันเดิม): ต่อวันเห็นว่ากะไหนปิดแล้ว (ใคร ยอด ผลต่าง)
 * กะไหนขาด ใครมีเวรตามตาราง และวันนั้น "ปิดร้าน" แล้วหรือยัง
 * ใช้ทั้งมุมมองการ์ดรายวันและปฏิทินในหน้าประวัติ
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  const month = searchParams.get("month"); // YYYY-MM
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: "กรุณาระบุเดือน (YYYY-MM)" }, { status: 400 });
  }
  const monthStart = `${month}-01`;

  try {
    const [shifts, closings, schedule, closedDays] = await Promise.all([
      sql`
        SELECT id, name, start_time as "startTime", end_time as "endTime", color
        FROM shifts WHERE store_id = ${storeId} ORDER BY start_time ASC
      `,
      sql`
        SELECT cc.id, TO_CHAR(cc.business_date, 'YYYY-MM-DD') as "businessDate",
               cc.shift_id as "shiftId", cc.opening_float as "openingFloat",
               cc.withdrawals_total as "withdrawalsTotal", cc.counted_amount as "countedAmount",
               cc.difference, cc.is_day_close as "isDayClose", cc.schedule_mismatch as "scheduleMismatch",
               cc.count_method as "countMethod", cc.discrepancy_reason as "discrepancyReason",
               cc.discrepancy_note as "discrepancyNote", cc.acknowledged_at as "acknowledgedAt",
               cc.edit_history as "editHistory", cc.created_at as "createdAt",
               u.name as "closedByName", s.name as "shiftName",
               ack.name as "acknowledgedByName"
        FROM cash_closings cc
        LEFT JOIN users u ON u.id = cc.closed_by_user_id
        LEFT JOIN shifts s ON s.id = cc.shift_id
        LEFT JOIN users ack ON ack.id = cc.acknowledged_by_user_id
        WHERE cc.store_id = ${storeId}
          AND cc.business_date >= ${monthStart}::date
          AND cc.business_date < (${monthStart}::date + interval '1 month')
        ORDER BY cc.created_at ASC
      `,
      sql`
        SELECT TO_CHAR(se.work_date, 'YYYY-MM-DD') as "workDate", se.shift_id as "shiftId", u.name
        FROM schedule_entries se
        JOIN users u ON u.id = se.user_id
        WHERE se.store_id = ${storeId}
          AND se.work_date >= ${monthStart}::date
          AND se.work_date < (${monthStart}::date + interval '1 month')
      `,
      sql`
        SELECT TO_CHAR(business_date, 'YYYY-MM-DD') as "businessDate", reason
        FROM store_closed_days
        WHERE store_id = ${storeId}
          AND business_date >= ${monthStart}::date
          AND business_date < (${monthStart}::date + interval '1 month')
      `,
    ]);

    return NextResponse.json({ month, shifts, closings, schedule, closedDays });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
