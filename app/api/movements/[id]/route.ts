import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";
import { isWithinEditWindow, EDIT_WINDOW_ERROR, verifyMasterPassword, logRecordEdit } from "@/lib/recordEdit";

const VALID_TYPES = ["MOVE_IN", "MOVE_OUT"];

/**
 * แก้ไข/ลบรายการรับเข้า-เบิกออกย้อนหลัง (ภายใน 7 วัน, ต้องยืนยันรหัสผ่านหลัก)
 * สต็อกสินค้าจะถูกปรับตามอัตโนมัติในทรานแซกชันเดียวกัน:
 * ย้อนผลของรายการเดิมออกก่อน แล้วใส่ผลของรายการใหม่เข้าไป
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { qty, type, note, password } = body;

    const auth = await verifyMasterPassword(user, password);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const newQty = Number(qty);
    if (!newQty || newQty <= 0) return NextResponse.json({ error: "จำนวนไม่ถูกต้อง" }, { status: 400 });
    if (type !== undefined && !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "ประเภทการเคลื่อนย้ายไม่ถูกต้อง" }, { status: 400 });
    }

    const [existing] = await sql`SELECT store_id, created_at FROM movements WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });

    const storeId = await resolveStoreId(user, String(existing.store_id));
    if (!storeId || Number(storeId) !== existing.store_id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงร้านนี้" }, { status: 403 });
    }
    if (!isWithinEditWindow(existing.created_at)) {
      return NextResponse.json({ error: EDIT_WINDOW_ERROR }, { status: 403 });
    }

    const result = await sql.begin(async (sql) => {
      const [m] = await sql`SELECT * FROM movements WHERE id = ${id} FOR UPDATE`;
      if (!m) throw new Error("ไม่พบรายการ");

      const newType = type ?? m.type;
      const newNote = note !== undefined ? note : m.note;

      if (Number(m.qty) === newQty && m.type === newType && m.note === newNote) {
        return { unchanged: true };
      }

      const [product] = await sql`
        SELECT stock FROM products WHERE id = ${m.product_id} AND store_id = ${m.store_id} FOR UPDATE
      `;
      if (!product) throw new Error("ไม่พบสินค้า");

      // ย้อนผลรายการเดิม แล้วใส่ผลรายการใหม่
      const oldEffect = m.type === "MOVE_IN" ? Number(m.qty) : -Number(m.qty);
      const newEffect = newType === "MOVE_IN" ? newQty : -newQty;
      const newStock = Number(product.stock) - oldEffect + newEffect;
      if (newStock < 0) {
        throw new Error(`แก้ไม่ได้ — สต็อกจะติดลบ (คงเหลือหลังแก้: ${newStock})`);
      }

      await sql`UPDATE products SET stock = ${newStock} WHERE id = ${m.product_id}`;
      await sql`
        UPDATE movements SET qty = ${newQty}, type = ${newType}, note = ${newNote ?? ""} WHERE id = ${id}
      `;
      await logRecordEdit(sql, {
        storeId: m.store_id, recordType: "movement", recordId: m.id, action: "edit", editedBy: user.id,
        oldValues: { qty: Number(m.qty), type: m.type, note: m.note },
        newValues: { qty: newQty, type: newType, note: newNote },
      });
      return { unchanged: false };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const known = message.startsWith("แก้ไม่ได้") || ["ไม่พบรายการ", "ไม่พบสินค้า"].includes(message);
    return NextResponse.json({ error: known ? message : "เกิดข้อผิดพลาด" }, { status: 400 });
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

    const [existing] = await sql`SELECT store_id, created_at FROM movements WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });

    const storeId = await resolveStoreId(user, String(existing.store_id));
    if (!storeId || Number(storeId) !== existing.store_id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงร้านนี้" }, { status: 403 });
    }
    if (!isWithinEditWindow(existing.created_at)) {
      return NextResponse.json({ error: EDIT_WINDOW_ERROR }, { status: 403 });
    }

    await sql.begin(async (sql) => {
      const [m] = await sql`SELECT * FROM movements WHERE id = ${id} FOR UPDATE`;
      if (!m) throw new Error("ไม่พบรายการ");

      const [product] = await sql`
        SELECT stock FROM products WHERE id = ${m.product_id} AND store_id = ${m.store_id} FOR UPDATE
      `;
      if (product) {
        const effect = m.type === "MOVE_IN" ? Number(m.qty) : -Number(m.qty);
        const newStock = Number(product.stock) - effect;
        if (newStock < 0) {
          throw new Error(`ลบไม่ได้ — สต็อกจะติดลบ (คงเหลือหลังลบ: ${newStock})`);
        }
        await sql`UPDATE products SET stock = ${newStock} WHERE id = ${m.product_id}`;
      }

      await logRecordEdit(sql, {
        storeId: m.store_id, recordType: "movement", recordId: m.id, action: "delete", editedBy: user.id,
        oldValues: { productId: m.product_id, qty: Number(m.qty), type: m.type, note: m.note },
      });
      await sql`DELETE FROM movements WHERE id = ${id}`;
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const known = message.startsWith("ลบไม่ได้") || message === "ไม่พบรายการ";
    return NextResponse.json({ error: known ? message : "เกิดข้อผิดพลาด" }, { status: 400 });
  }
}
