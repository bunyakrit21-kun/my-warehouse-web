import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";
import { getCurrentBusinessDate } from "@/lib/businessDay";
import { verifyStorePin } from "@/lib/pin";
import { getOverdueShiftInfo } from "@/lib/cashClosing";

const VALID_TYPES = ["MOVE_IN", "MOVE_OUT"] as const;

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  try {
    const movements = await sql`
      SELECT
        m.id,
        m.created_at,
        m.type,
        m.qty,
        m.note,
        m.employee_pin,
        p.name AS product_name,
        p.unit,
        u.name AS employee_name
      FROM movements m
      LEFT JOIN products p ON p.id = m.product_id
      LEFT JOIN users u ON u.id = m.user_id
      WHERE m.store_id = ${storeId}
      ORDER BY m.created_at DESC
      LIMIT 50
    `;
    return NextResponse.json(movements);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { productId, type, qty, note, pin, storeId: bodyStoreId } = body;

    if (!productId || !qty || qty <= 0) {
      return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "ประเภทการเคลื่อนย้ายไม่ถูกต้อง" }, { status: 400 });
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

    // Block new stock movements once a shift has ended without its drawer being
    // counted — same rule the movement screen shows as a banner, enforced here too
    // so it can't be skipped by calling this endpoint directly.
    const overdueInfo = await getOverdueShiftInfo(storeId);
    if (overdueInfo.overdue) {
      return NextResponse.json(
        { error: `ถึงเวลาปิดกะ "${overdueInfo.shift?.name}" แล้ว กรุณานับเงินปิดยอดก่อนทำรายการต่อ`, overdueShift: true },
        { status: 409 }
      );
    }

    const businessDate = await getCurrentBusinessDate(storeId);

    const result = await sql.begin(async (sql) => {
      const products = await sql`
        SELECT stock FROM products
        WHERE id = ${productId} AND store_id = ${storeId}
        FOR UPDATE
      `;

      if (products.length === 0) throw new Error("ไม่พบสินค้า");

      const product = products[0];

      if (type === "MOVE_OUT" && product.stock < qty) {
        throw new Error("สต็อกไม่เพียงพอสำหรับการเบิก");
      }

      await sql`
        INSERT INTO movements (product_id, user_id, type, qty, note, store_id, business_date)
        VALUES (${productId}, ${employee.id}, ${type}, ${qty}, ${note || ""}, ${storeId}, ${businessDate})
      `;

      const change = type === "MOVE_IN" ? qty : -qty;
      await sql`
        UPDATE products SET stock = stock + ${change}
        WHERE id = ${productId} AND store_id = ${storeId}
      `;

      return { success: true };
    });

    return NextResponse.json(result);
  } catch (error) {
    const known = ["ไม่พบสินค้า", "สต็อกไม่เพียงพอสำหรับการเบิก"];
    const message = error instanceof Error ? error.message : "";
    const msg = known.includes(message) ? message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
