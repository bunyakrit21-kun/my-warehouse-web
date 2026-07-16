import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";

/**
 * ปิดยอดย้อนหลังสำหรับวันที่ลืมปิด — เจ้าของร้านเท่านั้น
 * เจ้าของกรอก "ยอดขายเงินสดของวันนั้น" ตรงๆ (ไม่ต้องรื้อยอดลิ้นชักย้อนหลัง)
 * → สร้างรายการปิดร้าน (is_day_close=true) ของวันนั้น + ลงบัญชีเป็นรายรับ
 * ผลคือวันนั้นหลุดจาก "วันค้างปิดยอด" ระบบเดินต่อได้
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  try {
    const { storeId: bodyStoreId, businessDate, cashSales, note } = await request.json();
    const storeId = await resolveStoreId(user, bodyStoreId);
    if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });
    if (!businessDate || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง" }, { status: 400 });
    }
    const sales = Number(cashSales);
    if (!Number.isFinite(sales) || sales < 0) {
      return NextResponse.json({ error: "กรุณากรอกยอดขายเงินสดของวันนั้น" }, { status: 400 });
    }

    // กันปิดซ้ำ: ถ้าวันนั้นมี day-close อยู่แล้วไม่ต้องทำ
    const [existing] = await sql`
      SELECT id FROM cash_closings WHERE store_id = ${storeId} AND business_date = ${businessDate}::date AND is_day_close = true
    `;
    if (existing) return NextResponse.json({ error: "วันนี้ปิดยอดไปแล้ว" }, { status: 409 });

    await sql.begin(async (sql) => {
      const [closing] = await sql`
        INSERT INTO cash_closings (
          store_id, shift_id, business_date, opening_float, cash_sales, withdrawals_total,
          expected_amount, counted_amount, difference, count_method,
          closed_by_user_id, is_day_close, discrepancy_note
        ) VALUES (
          ${storeId}, NULL, ${businessDate}::date, 0, ${sales}, 0,
          ${sales}, ${sales}, 0, 'quick',
          ${user.id}, true, ${note || 'ปิดยอดย้อนหลัง'}
        )
        RETURNING id
      `;

      // ลงบัญชีเป็นรายรับของวันนั้น (ยอดขายเงินสด) — คงที่ตามที่เจ้าของกรอก
      const [account] = await sql`
        SELECT id FROM accounts WHERE store_id = ${storeId} AND is_default_cash = true AND archived_at IS NULL FOR UPDATE
      `;
      if (account && sales > 0) {
        const [category] = await sql`
          SELECT id FROM transaction_categories WHERE store_id = ${storeId} AND type = 'income' AND is_system = true LIMIT 1
        `;
        const [store] = await sql`SELECT owner_id FROM stores WHERE id = ${storeId}`;
        if (category) {
          await sql`UPDATE accounts SET current_balance = current_balance + ${sales} WHERE id = ${account.id}`;
          await sql`
            INSERT INTO transactions (store_id, account_id, category_id, type, amount, business_date, source, source_ref_id, created_by, note)
            VALUES (${storeId}, ${account.id}, ${category.id}, 'income', ${sales}, ${businessDate}::date, 'cash_closing', ${closing.id}, ${store.owner_id}, 'ปิดยอดย้อนหลัง')
          `;
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
