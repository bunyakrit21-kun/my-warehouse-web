import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";
import { syncCashClosingTransaction } from "@/lib/accounting";
import { isWithinEditWindow, EDIT_WINDOW_ERROR, verifyMasterPassword, logRecordEdit } from "@/lib/recordEdit";
import { isRateLimited } from "@/lib/rateLimit";

const VALID_METHODS = ["quick", "detailed"];
const VALID_REASONS = ["wrong_change", "missed_withdrawal_log", "counterfeit_damaged", "other"];

type EditableValue = string | number | null;

interface EditHistoryEntry {
  editedByUserId: number;
  editedByName: string;
  editedAt: string;
  changes: Record<string, { from: EditableValue; to: EditableValue }>;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  try {
    const [existing] = await sql`SELECT store_id, created_at FROM cash_closings WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: "ไม่พบรายการปิดยอด" }, { status: 404 });

    // resolveStoreId ignores its requestedStoreId argument for staff-type tokens (it always
    // returns the caller's own store), so it must be checked against the resource's actual
    // store, not just for truthiness — otherwise any manager could act on any other store's closing.
    const resolvedStoreId = await resolveStoreId(user, String(existing.store_id));
    if (!resolvedStoreId || Number(resolvedStoreId) !== existing.store_id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงร้านนี้" }, { status: 403 });
    }

    const body = await request.json();

    // --- Acknowledge action (manager sign-off, no field edits) ---
    if (body.acknowledge === true) {
      await sql`
        UPDATE cash_closings SET acknowledged_by_user_id = ${user.id}, acknowledged_at = now()
        WHERE id = ${id}
      `;
      return NextResponse.json({ success: true });
    }

    // --- Edit fields (correcting an already-closed record) — password required every time,
    // same as the accounting ledger's transaction edits (spec-07 §6.2): this changes the
    // official record of how much cash was actually counted, so it needs more than just an
    // existing admin/manager session.
    const { countedAmount, countMethod, denominationBreakdown, discrepancyReason, discrepancyNote, password, businessDate } = body;

    if (businessDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(businessDate))) {
      return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง" }, { status: 400 });
    }

    // แก้ตัวเลขย้อนหลังได้ภายใน 7 วันเท่านั้น (การเซ็นรับทราบด้านบนไม่จำกัดเวลา)
    if (!isWithinEditWindow(existing.created_at)) {
      return NextResponse.json({ error: EDIT_WINDOW_ERROR }, { status: 403 });
    }

    if (!password) return NextResponse.json({ error: "กรุณายืนยันรหัสผ่านก่อนบันทึกการแก้ไข" }, { status: 400 });
    if (isRateLimited(`closing-edit-auth:${user.id}`, 5, 5 * 60 * 1000)) {
      return NextResponse.json({ error: "ลองยืนยันตัวตนผิดหลายครั้งเกินไป กรุณาลองใหม่ในอีกสักครู่" }, { status: 429 });
    }
    const [userRow] = await sql`SELECT password FROM users WHERE id = ${user.id} AND active = true`;
    if (!userRow) return NextResponse.json({ error: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });
    const passwordOk = await bcrypt.compare(password, userRow.password);
    if (!passwordOk) return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });

    if (countedAmount === undefined || countedAmount === null || !Number.isFinite(Number(countedAmount)) || Number(countedAmount) < 0) {
      return NextResponse.json({ error: "กรุณากรอกยอดที่นับได้" }, { status: 400 });
    }
    if (!VALID_METHODS.includes(countMethod)) {
      return NextResponse.json({ error: "วิธีนับไม่ถูกต้อง" }, { status: 400 });
    }
    if (discrepancyReason && !VALID_REASONS.includes(discrepancyReason)) {
      return NextResponse.json({ error: "เหตุผลไม่ถูกต้อง" }, { status: 400 });
    }

    const result = await sql.begin(async (sql) => {
      // Lock the row for the duration of the diff+update so two concurrent edits can't both
      // read the same stale snapshot and silently overwrite each other's changes/audit entry.
      const [row] = await sql`SELECT * FROM cash_closings WHERE id = ${id} FOR UPDATE`;
      if (!row) return null;

      const newDifference = Number(countedAmount) - Number(row.expected_amount);
      // Preserve the existing breakdown unless the caller explicitly sent a new one —
      // a "quick" re-edit of an old "detailed" closing must not silently erase it.
      const newBreakdown = denominationBreakdown !== undefined ? denominationBreakdown : row.denomination_breakdown;

      const changes: EditHistoryEntry["changes"] = {};
      if (Number(countedAmount) !== Number(row.counted_amount)) {
        changes.countedAmount = { from: Number(row.counted_amount), to: Number(countedAmount) };
      }
      if (countMethod !== row.count_method) {
        changes.countMethod = { from: row.count_method, to: countMethod };
      }
      if ((discrepancyReason ?? null) !== row.discrepancy_reason) {
        changes.discrepancyReason = { from: row.discrepancy_reason, to: discrepancyReason ?? null };
      }
      if ((discrepancyNote ?? null) !== row.discrepancy_note) {
        changes.discrepancyNote = { from: row.discrepancy_note, to: discrepancyNote ?? null };
      }
      const oldBusinessDate = typeof row.business_date === "string"
        ? row.business_date.slice(0, 10)
        : new Date(row.business_date).toISOString().slice(0, 10);
      const newBusinessDate = businessDate !== undefined ? String(businessDate) : oldBusinessDate;
      if (newBusinessDate !== oldBusinessDate) {
        changes.businessDate = { from: oldBusinessDate, to: newBusinessDate };
      }

      if (Object.keys(changes).length === 0) {
        return { unchanged: true, difference: Number(row.difference) };
      }

      const entry: EditHistoryEntry = {
        editedByUserId: user.id,
        editedByName: user.name,
        editedAt: new Date().toISOString(),
        changes,
      };
      const history: EditHistoryEntry[] = Array.isArray(row.edit_history) ? row.edit_history : [];
      history.push(entry);
      // postgres.js's JSONValue type doesn't structurally match a named interface[]; the value is plain JSON at runtime.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const historyJson = sql.json(history as any);

      await sql`
        UPDATE cash_closings SET
          counted_amount = ${countedAmount},
          difference = ${newDifference},
          count_method = ${countMethod},
          denomination_breakdown = ${newBreakdown ? sql.json(newBreakdown) : null},
          discrepancy_reason = ${discrepancyReason ?? null},
          discrepancy_note = ${discrepancyNote ?? null},
          edit_history = ${historyJson}
        WHERE id = ${id}
      `;

      // spec-07 section 5.2: corrections flow one-way from cash_closings into the ledger.
      // Nudge the linked transaction (if any — only the day's last-shift closing has one,
      // postings are balance-relative) by the same amount the count changed by.
      if (changes.countedAmount) {
        const countedAmountDelta = Number(countedAmount) - Number(row.counted_amount);
        await syncCashClosingTransaction(sql, Number(id), countedAmountDelta);
      }

      return { unchanged: false, difference: newDifference };
    });

    if (!result) return NextResponse.json({ error: "ไม่พบรายการปิดยอด" }, { status: 404 });
    return NextResponse.json({ success: true, difference: result.difference, unchanged: result.unchanged });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

/**
 * ลบรายการปิดยอด (ภายใน 7 วัน + รหัสผ่านหลัก) — ลบได้เฉพาะ "รายการล่าสุดของร้าน"
 * เท่านั้น เพราะยอดตั้งต้นของแต่ละกะส่งต่อกันเป็นโซ่ ลบตัวกลางจะทำให้ยอดกะถัดไปผิดหมด
 * ใช้สำหรับกรณีปิดยอดพลาดแล้วอยากลบเพื่อปิดใหม่ (undo)
 *
 * ย้อนผลทางบัญชีให้ครบ: รายการรายรับ (source='cash_closing') และรายการโอนเก็บเงิน
 * ปิดร้าน (source='cash_closing_dayclose') ถูกลบพร้อมปรับยอดบัญชีคืน แล้วบันทึก audit
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { password } = await request.json();

    const auth = await verifyMasterPassword(user, password);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const [existing] = await sql`SELECT store_id, created_at FROM cash_closings WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: "ไม่พบรายการปิดยอด" }, { status: 404 });

    const resolvedStoreId = await resolveStoreId(user, String(existing.store_id));
    if (!resolvedStoreId || Number(resolvedStoreId) !== existing.store_id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงร้านนี้" }, { status: 403 });
    }
    if (!isWithinEditWindow(existing.created_at)) {
      return NextResponse.json({ error: EDIT_WINDOW_ERROR }, { status: 403 });
    }

    const [newer] = await sql`
      SELECT id FROM cash_closings
      WHERE store_id = ${existing.store_id} AND created_at > ${existing.created_at}
      LIMIT 1
    `;
    if (newer) {
      return NextResponse.json(
        { error: "ลบได้เฉพาะรายการปิดยอดล่าสุดเท่านั้น (ยอดตั้งต้นของกะถัดไปอ้างจากรายการนี้)" },
        { status: 409 }
      );
    }

    await sql.begin(async (sql) => {
      const [row] = await sql`SELECT * FROM cash_closings WHERE id = ${id} FOR UPDATE`;
      if (!row) throw new Error("ไม่พบรายการปิดยอด");

      // ย้อนรายการบัญชีที่ผูกกับการปิดยอดนี้ (รายรับ + โอนเก็บเงินปิดร้าน)
      const linked = await sql`
        SELECT id, type, amount, account_id, transfer_to_account_id FROM transactions
        WHERE source IN ('cash_closing', 'cash_closing_dayclose') AND source_ref_id = ${id}
        FOR UPDATE
      `;
      for (const tx of linked) {
        const amount = Number(tx.amount);
        if (tx.type === "income") {
          await sql`UPDATE accounts SET current_balance = current_balance - ${amount} WHERE id = ${tx.account_id}`;
        } else if (tx.type === "transfer") {
          await sql`UPDATE accounts SET current_balance = current_balance + ${amount} WHERE id = ${tx.account_id}`;
          await sql`UPDATE accounts SET current_balance = current_balance - ${amount} WHERE id = ${tx.transfer_to_account_id}`;
        }
        await sql`DELETE FROM transaction_edit_history WHERE transaction_id = ${tx.id}`;
        await sql`DELETE FROM transactions WHERE id = ${tx.id}`;
      }

      await logRecordEdit(sql, {
        storeId: row.store_id, recordType: "cash_closing", recordId: row.id, action: "delete", editedBy: user.id,
        oldValues: {
          businessDate: String(row.business_date), shiftId: row.shift_id,
          openingFloat: Number(row.opening_float), countedAmount: Number(row.counted_amount),
          difference: Number(row.difference), isDayClose: !!row.is_day_close,
          closedByUserId: row.closed_by_user_id,
        },
      });
      await sql`DELETE FROM cash_closings WHERE id = ${id}`;
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message === "ไม่พบรายการปิดยอด" ? message : "เกิดข้อผิดพลาด" }, { status: 400 });
  }
}
