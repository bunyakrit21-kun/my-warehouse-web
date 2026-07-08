import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";
import { getCurrentBusinessDate, getStoreTimeContext } from "@/lib/businessDay";
import { detectCurrentShift } from "@/lib/cashClosing";

/**
 * Per-shift closing status for TODAY (current business date) — the glue between
 * the shift schedule, cash closings, and the dashboard: for every configured
 * shift, who's scheduled to work it, whether it's been closed, by whom, and how
 * much cash that shift produced (counted − opening float + withdrawals, since
 * counting is cumulative across the whole drawer).
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

  try {
    const { timezone } = await getStoreTimeContext(storeId);
    const businessDate = await getCurrentBusinessDate(storeId);
    const { shift: currentShift, shifts } = await detectCurrentShift(storeId, timezone);

    const [closings, scheduled] = await Promise.all([
      sql`
        SELECT cc.id, cc.shift_id as "shiftId", cc.counted_amount as "countedAmount",
               cc.opening_float as "openingFloat", cc.withdrawals_total as "withdrawalsTotal",
               cc.difference, cc.created_at as "createdAt",
               u.name as "closedByName"
        FROM cash_closings cc
        LEFT JOIN users u ON u.id = cc.closed_by_user_id
        WHERE cc.store_id = ${storeId} AND cc.business_date = ${businessDate}::date
        ORDER BY cc.created_at ASC
      `,
      sql`
        SELECT se.shift_id as "shiftId", u.name
        FROM schedule_entries se
        JOIN users u ON u.id = se.user_id
        WHERE se.store_id = ${storeId} AND se.work_date = ${businessDate}::date
      `,
    ]);

    const result = shifts.map((s) => {
      const closing = closings.filter((c) => c.shiftId === s.id).at(-1) ?? null;
      return {
        id: s.id,
        name: s.name,
        startTime: s.start_time,
        endTime: s.end_time,
        color: s.color,
        isCurrent: currentShift?.id === s.id,
        scheduledStaff: scheduled.filter((e) => e.shiftId === s.id).map((e) => e.name),
        closing: closing
          ? {
              id: closing.id,
              countedAmount: Number(closing.countedAmount),
              // เงินสดที่กะนี้ทำได้เอง — นับทั้งลิ้นชักจึงต้องหักยอดตั้งต้นและบวกเงินที่เบิกออก
              shiftCash: Number(closing.countedAmount) - Number(closing.openingFloat) + Number(closing.withdrawalsTotal),
              difference: Number(closing.difference),
              closedByName: closing.closedByName as string | null,
              createdAt: closing.createdAt as string,
            }
          : null,
      };
    });

    return NextResponse.json({ businessDate, shifts: result });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
