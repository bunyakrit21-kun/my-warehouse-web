import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";
import { getCashClosingExpected } from "@/lib/cashClosing";
import { verifyStorePin } from "@/lib/pin";

const VALID_METHODS = ["quick", "detailed"];
const VALID_REASONS = ["wrong_change", "missed_withdrawal_log", "counterfeit_damaged", "other"];

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const {
      storeId: bodyStoreId, shiftId, cashSales, countedAmount, countMethod,
      denominationBreakdown, discrepancyReason, discrepancyNote, pin,
    } = await request.json();

    if (countedAmount === undefined || countedAmount === null || Number(countedAmount) < 0) {
      return NextResponse.json({ error: "กรุณากรอกยอดที่นับได้" }, { status: 400 });
    }
    if (!VALID_METHODS.includes(countMethod)) {
      return NextResponse.json({ error: "วิธีนับไม่ถูกต้อง" }, { status: 400 });
    }
    if (discrepancyReason && !VALID_REASONS.includes(discrepancyReason)) {
      return NextResponse.json({ error: "เหตุผลไม่ถูกต้อง" }, { status: 400 });
    }
    if (!pin || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "กรุณาระบุ PIN" }, { status: 400 });
    }

    const storeId = await resolveStoreId(user, bodyStoreId);
    if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

    const pinResult = await verifyStorePin(storeId, pin);
    if (!pinResult.ok) {
      if (pinResult.reason === "locked") {
        const mins = Math.ceil(pinResult.retryAfterSeconds / 60);
        return NextResponse.json({ error: `ใส่ PIN ผิดหลายครั้งเกินไป กรุณาลองใหม่ในอีก ${mins} นาที` }, { status: 429 });
      }
      return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
    }
    const employee = pinResult.user;

    const { businessDate, shift, openingFloat, withdrawalsTotal } = await getCashClosingExpected(storeId);
    const salesNum = Number(cashSales) || 0;
    const expectedAmount = openingFloat + salesNum - withdrawalsTotal;
    const difference = Number(countedAmount) - expectedAmount;
    const resolvedShiftId = shiftId ?? shift?.id ?? null;

    const [row] = await sql`
      INSERT INTO cash_closings (
        store_id, shift_id, business_date, opening_float, cash_sales, withdrawals_total,
        expected_amount, counted_amount, difference, count_method, denomination_breakdown,
        discrepancy_reason, discrepancy_note, closed_by_user_id
      ) VALUES (
        ${storeId}, ${resolvedShiftId}, ${businessDate}::date, ${openingFloat}, ${salesNum}, ${withdrawalsTotal},
        ${expectedAmount}, ${countedAmount}, ${difference}, ${countMethod},
        ${denominationBreakdown ? JSON.stringify(denominationBreakdown) : null},
        ${discrepancyReason ?? null}, ${discrepancyNote ?? null}, ${employee.id}
      )
      RETURNING id
    `;

    return NextResponse.json({ success: true, id: row.id, expectedAmount, difference }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
