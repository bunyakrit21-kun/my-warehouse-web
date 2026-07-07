import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";

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
    const rows = await sql`
      SELECT cc.id, cc.business_date as "businessDate", cc.opening_float as "openingFloat",
             cc.cash_sales as "cashSales", cc.withdrawals_total as "withdrawalsTotal",
             cc.expected_amount as "expectedAmount", cc.counted_amount as "countedAmount",
             cc.difference, cc.count_method as "countMethod", cc.discrepancy_reason as "discrepancyReason",
             cc.discrepancy_note as "discrepancyNote", cc.created_at as "createdAt",
             s.name as "shiftName",
             u.name as "closedByName"
      FROM cash_closings cc
      LEFT JOIN shifts s ON s.id = cc.shift_id
      LEFT JOIN users u ON u.id = cc.closed_by_user_id
      WHERE cc.store_id = ${storeId}
      ORDER BY cc.created_at DESC
      LIMIT 50
    `;
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
