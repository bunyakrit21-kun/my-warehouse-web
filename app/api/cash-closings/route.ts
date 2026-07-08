import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";
import { getCashClosingExpected } from "@/lib/cashClosing";
import { verifyStorePin } from "@/lib/pin";
import { postCashClosingTransaction, postDayCloseTransfer } from "@/lib/accounting";

const VALID_METHODS = ["quick", "detailed"];
const VALID_REASONS = ["wrong_change", "missed_withdrawal_log", "counterfeit_damaged", "other"];

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const {
      storeId: bodyStoreId, shiftId, cashSales, countedAmount, countMethod,
      denominationBreakdown, discrepancyReason, discrepancyNote, pin, isDayClose,
    } = await request.json();

    if (countedAmount === undefined || countedAmount === null || !Number.isFinite(Number(countedAmount)) || Number(countedAmount) < 0) {
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

    const { businessDate, shift, shifts, openingFloat, withdrawalsTotal, drawerFloat, suggestDayClose } = await getCashClosingExpected(storeId);
    const salesNum = Number(cashSales) || 0;
    const expectedAmount = openingFloat + salesNum - withdrawalsTotal;
    const difference = Number(countedAmount) - expectedAmount;
    const resolvedShiftId = shiftId ?? shift?.id ?? null;
    // ปิดร้านประจำวัน: client ส่งมาชัดๆ ได้ ไม่ส่งมาก็ใช้ค่าที่ระบบเดา (กะสุดท้ายตามเวลา)
    const dayClose = typeof isDayClose === "boolean" ? isDayClose : suggestDayClose;

    // Flag when whoever confirmed with their PIN wasn't on the schedule for this shift —
    // but only if the shift actually has assignments (stores without a schedule aren't flagged).
    let scheduleMismatch = false;
    if (resolvedShiftId) {
      const scheduled = await sql`
        SELECT user_id FROM schedule_entries
        WHERE store_id = ${storeId} AND shift_id = ${resolvedShiftId} AND work_date = ${businessDate}::date
      `;
      scheduleMismatch = scheduled.length > 0 && !scheduled.some(s => s.user_id === employee.id);
    }

    const closingId = await sql.begin(async (sql) => {
      const [row] = await sql`
        INSERT INTO cash_closings (
          store_id, shift_id, business_date, opening_float, cash_sales, withdrawals_total,
          expected_amount, counted_amount, difference, count_method, denomination_breakdown,
          discrepancy_reason, discrepancy_note, closed_by_user_id, schedule_mismatch, is_day_close
        ) VALUES (
          ${storeId}, ${resolvedShiftId}, ${businessDate}::date, ${openingFloat}, ${salesNum}, ${withdrawalsTotal},
          ${expectedAmount}, ${countedAmount}, ${difference}, ${countMethod},
          ${denominationBreakdown ? sql.json(denominationBreakdown) : null},
          ${discrepancyReason ?? null}, ${discrepancyNote ?? null}, ${employee.id}, ${scheduleMismatch}, ${dayClose}
        )
        RETURNING id
      `;

      // EVERY shift's closing posts its own ledger entry (per-shift income in the
      // accounting page, and stores whose shift lineup varies day-to-day never lose
      // a day's revenue). Amount is balance-relative — counted minus the ledger's
      // running cash balance — because counting is cumulative across shifts; this
      // keeps ledger balance == drawer after every closing, and each entry equals
      // the cash that shift added. See postCashClosingTransaction.
      {
        const [account] = await sql`
          SELECT current_balance FROM accounts WHERE store_id = ${storeId} AND is_default_cash = true AND archived_at IS NULL
          FOR UPDATE
        `;
        if (account) {
          const ledgerAmount = Number(countedAmount) - Number(account.current_balance);
          const shiftName = shifts.find(s => s.id === resolvedShiftId)?.name ?? null;
          await postCashClosingTransaction(sql, storeId, row.id, ledgerAmount, businessDate, shiftName);
        }
      }

      // ปิดร้าน: เก็บเงินส่วนที่เกิน "เงินในเก๊ะ" ออกจากลิ้นชัก → บัญชี "เงินเก็บ"
      // ยอดเงินสดในบัญชีจะเหลือเท่า drawerFloat พร้อมเริ่มวันใหม่
      if (dayClose) {
        await postDayCloseTransfer(sql, storeId, row.id, Number(countedAmount) - drawerFloat, businessDate);
      }

      return row.id;
    });

    return NextResponse.json({ success: true, id: closingId, expectedAmount, difference }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
