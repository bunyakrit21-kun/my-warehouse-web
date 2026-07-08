import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";
import { isWithinEditWindow, EDIT_WINDOW_ERROR, logRecordEdit } from "@/lib/recordEdit";
import { isRateLimited } from "@/lib/rateLimit";

/**
 * Edits a past transaction (spec-07 section 6.2). Unlike page-entry step-up
 * (15-min cookie), every single edit must include the login password fresh in
 * the request body and gets verified here — no caching, by design.
 *
 * Editable: amount, note, and (for income/expense only) categoryId. The account(s)
 * a transaction posted against are not editable — reassigning accounts after the
 * fact means re-deriving two balances instead of one and isn't something the spec
 * asked for; delete-and-recreate covers that case if it's ever needed.
 *
 * source='cash_closing' transactions stay locked here — see spec-07 section 6.4 /
 * lib/accounting.ts syncCashClosingTransaction, which is the only path allowed to
 * change their amount (by correcting the cash_closings row they came from).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  if (isRateLimited(`tx-edit-auth:${user.id}`, 5, 5 * 60 * 1000)) {
    return NextResponse.json({ error: "ลองยืนยันตัวตนผิดหลายครั้งเกินไป กรุณาลองใหม่ในอีกสักครู่" }, { status: 429 });
  }

  try {
    const { password, amount, note, categoryId } = await request.json();

    if (!password) return NextResponse.json({ error: "กรุณายืนยันรหัสผ่านก่อนบันทึกการแก้ไข" }, { status: 400 });
    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: "กรุณากรอกจำนวนเงิน" }, { status: 400 });

    const [userRow] = await sql`SELECT password FROM users WHERE id = ${user.id} AND active = true`;
    if (!userRow) return NextResponse.json({ error: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });
    const passwordOk = await bcrypt.compare(password, userRow.password);
    if (!passwordOk) return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });

    const [existing] = await sql`SELECT * FROM transactions WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });

    const storeId = await resolveStoreId(user, String(existing.store_id));
    if (!storeId) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงร้านนี้" }, { status: 403 });

    if (!isWithinEditWindow(existing.created_at)) {
      return NextResponse.json({ error: EDIT_WINDOW_ERROR }, { status: 403 });
    }

    if (existing.source && existing.source !== "manual") {
      return NextResponse.json(
        { error: "รายการนี้ระบบสร้างอัตโนมัติ (ปิดยอด/เบิกเงิน) แก้ที่ต้นทางแทน — ประวัติปิดยอด หรือรายการเบิกในหน้าเบิก-รับ" },
        { status: 400 }
      );
    }

    const amountNum = Number(amount);
    const newCategoryId = existing.type === "transfer" ? existing.category_id : (categoryId ? Number(categoryId) : existing.category_id);

    if (existing.type !== "transfer" && newCategoryId) {
      const [category] = await sql`
        SELECT id FROM transaction_categories WHERE id = ${newCategoryId} AND store_id = ${storeId} AND type = ${existing.type}
      `;
      if (!category) return NextResponse.json({ error: "ไม่พบหมวดหมู่" }, { status: 400 });
    }

    const oldValues = {
      amount: existing.amount, note: existing.note, category_id: existing.category_id,
    };
    const newValues = {
      amount: amountNum, note: note ?? existing.note, category_id: newCategoryId,
    };

    await sql.begin(async (sql) => {
      const delta = amountNum - Number(existing.amount);

      if (delta !== 0) {
        if (existing.type === "income") {
          await sql`UPDATE accounts SET current_balance = current_balance + ${delta} WHERE id = ${existing.account_id}`;
        } else if (existing.type === "expense") {
          await sql`UPDATE accounts SET current_balance = current_balance - ${delta} WHERE id = ${existing.account_id}`;
        } else {
          // transfer: same delta moves out of the source account and into the destination
          await sql`UPDATE accounts SET current_balance = current_balance - ${delta} WHERE id = ${existing.account_id}`;
          await sql`UPDATE accounts SET current_balance = current_balance + ${delta} WHERE id = ${existing.transfer_to_account_id}`;
        }
      }

      await sql`
        UPDATE transactions
        SET amount = ${amountNum}, note = ${newValues.note}, category_id = ${newCategoryId},
            last_edited_by = ${user.id}, last_edited_at = now()
        WHERE id = ${id}
      `;

      await sql`
        INSERT INTO transaction_edit_history (transaction_id, edited_by, old_values, new_values)
        VALUES (${id}, ${user.id}, ${sql.json(oldValues)}, ${sql.json(newValues)})
      `;
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const known = ["ไม่พบหมวดหมู่"];
    return NextResponse.json({ error: known.includes(message) ? message : "เกิดข้อผิดพลาด" }, { status: 400 });
  }
}

/**
 * ลบรายการบัญชีย้อนหลัง (ภายใน 7 วัน, ต้องยืนยันรหัสผ่านสดเหมือนการแก้ไข)
 * ย้อนยอดบัญชีที่รายการนี้เคยขยับไว้กลับคืน แล้วบันทึก audit ลง record_edits
 * รายการจากการปิดยอด (source='cash_closing') ลบไม่ได้ — ต้องแก้ที่ประวัติปิดยอด
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  if (isRateLimited(`tx-edit-auth:${user.id}`, 5, 5 * 60 * 1000)) {
    return NextResponse.json({ error: "ลองยืนยันตัวตนผิดหลายครั้งเกินไป กรุณาลองใหม่ในอีกสักครู่" }, { status: 429 });
  }

  try {
    const { password } = await request.json();
    if (!password) return NextResponse.json({ error: "กรุณายืนยันรหัสผ่านก่อนลบรายการ" }, { status: 400 });

    const [userRow] = await sql`SELECT password FROM users WHERE id = ${user.id} AND active = true`;
    if (!userRow) return NextResponse.json({ error: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });
    const passwordOk = await bcrypt.compare(password, userRow.password);
    if (!passwordOk) return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });

    const [existing] = await sql`SELECT * FROM transactions WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });

    const storeId = await resolveStoreId(user, String(existing.store_id));
    if (!storeId) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงร้านนี้" }, { status: 403 });

    if (!isWithinEditWindow(existing.created_at)) {
      return NextResponse.json({ error: EDIT_WINDOW_ERROR }, { status: 403 });
    }
    if (existing.source && existing.source !== "manual") {
      return NextResponse.json(
        { error: "รายการนี้ระบบสร้างอัตโนมัติ (ปิดยอด/เบิกเงิน) ลบที่ต้นทางแทน — ประวัติปิดยอด หรือรายการเบิกในหน้าเบิก-รับ" },
        { status: 400 }
      );
    }

    await sql.begin(async (sql) => {
      const [tx] = await sql`SELECT * FROM transactions WHERE id = ${id} FOR UPDATE`;
      if (!tx) throw new Error("ไม่พบรายการ");

      const amount = Number(tx.amount);
      if (tx.type === "income") {
        await sql`UPDATE accounts SET current_balance = current_balance - ${amount} WHERE id = ${tx.account_id}`;
      } else if (tx.type === "expense") {
        await sql`UPDATE accounts SET current_balance = current_balance + ${amount} WHERE id = ${tx.account_id}`;
      } else {
        // transfer: เงินเคยออกจากบัญชีต้นทางไปเข้าปลายทาง — ย้อนกลับ
        await sql`UPDATE accounts SET current_balance = current_balance + ${amount} WHERE id = ${tx.account_id}`;
        await sql`UPDATE accounts SET current_balance = current_balance - ${amount} WHERE id = ${tx.transfer_to_account_id}`;
      }

      await logRecordEdit(sql, {
        storeId: tx.store_id, recordType: "transaction", recordId: tx.id, action: "delete", editedBy: user.id,
        oldValues: {
          type: tx.type, amount, note: tx.note, categoryId: tx.category_id,
          accountId: tx.account_id, transferToAccountId: tx.transfer_to_account_id,
          businessDate: String(tx.business_date),
        },
      });
      await sql`DELETE FROM transaction_edit_history WHERE transaction_id = ${id}`;
      await sql`DELETE FROM transactions WHERE id = ${id}`;
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message === "ไม่พบรายการ" ? message : "เกิดข้อผิดพลาด" }, { status: 400 });
  }
}
