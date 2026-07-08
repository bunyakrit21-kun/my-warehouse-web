import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";
import { isWithinEditWindow, EDIT_WINDOW_ERROR, verifyMasterPassword, logRecordEdit } from "@/lib/recordEdit";

/**
 * แก้ไข/ลบรายการเบิกเงินย้อนหลัง (ภายใน 7 วัน, ต้องยืนยันรหัสผ่านหลัก)
 *
 * ข้อจำกัดสำคัญ: ถ้ามีการปิดยอดเกิดขึ้นหลังรายการเบิกนี้แล้ว รายการนี้ถูกนับรวมใน
 * ยอดปิดกะไปแล้ว (getCashClosingExpected สรุปยอดเบิกถึงเวลาปิด) — แก้ตรงนี้จะทำให้
 * ตัวเลขปิดยอดกับรายการเบิกขัดกันเอง ต้องไปแก้ที่ประวัติปิดยอดแทน
 */
async function findClosingAfter(storeId: number, createdAt: Date | string) {
  const [closing] = await sql`
    SELECT id FROM cash_closings WHERE store_id = ${storeId} AND created_at > ${createdAt} LIMIT 1
  `;
  return closing ?? null;
}

const LOCKED_BY_CLOSING = "รายการนี้ถูกนับรวมในการปิดยอดไปแล้ว แก้ที่นี่ไม่ได้ — ให้แก้ยอดที่ประวัติปิดยอดแทน";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { amount, reason, password } = await request.json();

    const auth = await verifyMasterPassword(user, password);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const newAmount = Number(amount);
    if (!newAmount || newAmount <= 0) return NextResponse.json({ error: "จำนวนเงินไม่ถูกต้อง" }, { status: 400 });
    if (!reason) return NextResponse.json({ error: "กรุณาระบุเหตุผล" }, { status: 400 });

    const [existing] = await sql`SELECT store_id, created_at FROM cash_withdrawals WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });

    const storeId = await resolveStoreId(user, String(existing.store_id));
    if (!storeId || Number(storeId) !== existing.store_id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงร้านนี้" }, { status: 403 });
    }
    if (!isWithinEditWindow(existing.created_at)) {
      return NextResponse.json({ error: EDIT_WINDOW_ERROR }, { status: 403 });
    }
    if (await findClosingAfter(existing.store_id, existing.created_at)) {
      return NextResponse.json({ error: LOCKED_BY_CLOSING }, { status: 409 });
    }

    await sql.begin(async (sql) => {
      const [w] = await sql`SELECT * FROM cash_withdrawals WHERE id = ${id} FOR UPDATE`;
      if (!w) throw new Error("ไม่พบรายการ");
      await sql`UPDATE cash_withdrawals SET amount = ${newAmount}, reason = ${reason} WHERE id = ${id}`;
      await logRecordEdit(sql, {
        storeId: w.store_id, recordType: "cash_withdrawal", recordId: w.id, action: "edit", editedBy: user.id,
        oldValues: { amount: Number(w.amount), reason: w.reason },
        newValues: { amount: newAmount, reason },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message === "ไม่พบรายการ" ? message : "เกิดข้อผิดพลาด" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { password } = await request.json();

    const auth = await verifyMasterPassword(user, password);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const [existing] = await sql`SELECT store_id, created_at FROM cash_withdrawals WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });

    const storeId = await resolveStoreId(user, String(existing.store_id));
    if (!storeId || Number(storeId) !== existing.store_id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงร้านนี้" }, { status: 403 });
    }
    if (!isWithinEditWindow(existing.created_at)) {
      return NextResponse.json({ error: EDIT_WINDOW_ERROR }, { status: 403 });
    }
    if (await findClosingAfter(existing.store_id, existing.created_at)) {
      return NextResponse.json({ error: LOCKED_BY_CLOSING }, { status: 409 });
    }

    await sql.begin(async (sql) => {
      const [w] = await sql`SELECT * FROM cash_withdrawals WHERE id = ${id} FOR UPDATE`;
      if (!w) throw new Error("ไม่พบรายการ");
      await logRecordEdit(sql, {
        storeId: w.store_id, recordType: "cash_withdrawal", recordId: w.id, action: "delete", editedBy: user.id,
        oldValues: { amount: Number(w.amount), reason: w.reason, userId: w.user_id },
      });
      await sql`DELETE FROM cash_withdrawals WHERE id = ${id}`;
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message === "ไม่พบรายการ" ? message : "เกิดข้อผิดพลาด" }, { status: 400 });
  }
}
