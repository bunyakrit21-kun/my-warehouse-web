import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser } from "@/lib/auth";

/**
 * หน้าของพนักงานเอง (login ด้วย PIN): ตารางงานของตัวเอง + สลิปเงินเดือน + ทิป
 * อ่านได้เฉพาะข้อมูลของ user.id ตัวเองเท่านั้น (ทั้ง staff และ admin ดูของตัวเองได้)
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from"); // YYYY-MM-DD (default: 30 วันย้อนหลัง)
  const fromDate = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : null;

  try {
    const [schedule, payslips] = await Promise.all([
      sql`
        SELECT se.id, TO_CHAR(se.work_date,'YYYY-MM-DD') AS "workDate",
               s.name AS "shiftName", TO_CHAR(s.start_time,'HH24:MI') AS "startTime",
               TO_CHAR(s.end_time,'HH24:MI') AS "endTime", s.color,
               se.duty, se.checked_in_at AS "checkedInAt"
        FROM schedule_entries se
        JOIN shifts s ON s.id = se.shift_id
        WHERE se.user_id = ${user.id}
          AND se.work_date >= ${fromDate ? sql`${fromDate}::date` : sql`(CURRENT_DATE - INTERVAL '30 days')`}
        ORDER BY se.work_date DESC, s.start_time
      `,
      sql`
        SELECT l.id, p.name AS "periodName", p.status,
               TO_CHAR(p.start_date,'YYYY-MM-DD') AS "startDate",
               TO_CHAR(p.end_date,'YYYY-MM-DD') AS "endDate",
               l.pay_type AS "payType", l.hours, l.monthly_amount AS "monthlyAmount",
               l.hourly_rate AS "hourlyRate", l.base_pay AS "basePay", l.tip_amount AS "tipAmount"
        FROM payroll_lines l
        JOIN payroll_periods p ON p.id = l.period_id
        WHERE l.user_id = ${user.id}
        ORDER BY p.start_date DESC, p.id DESC
        LIMIT 24
      `,
    ]);

    return NextResponse.json({
      name: user.name,
      schedule,
      // โชว์เงินเดือนเฉพาะงวดที่ปิดจ่ายแล้ว (draft = เจ้าของยังกรอกไม่เสร็จ ไม่ควรเห็น)
      payslips: payslips.filter((r) => r.status === "paid"),
    });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
