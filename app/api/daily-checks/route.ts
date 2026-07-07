import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";
import { getCurrentBusinessDate } from "@/lib/businessDay";
import { verifyStorePin } from "@/lib/pin";

// GET — today's check status for a store
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  try {
    const businessDate = await getCurrentBusinessDate(storeId);
    const checks = await sql`
      SELECT dc.id, dc.product_id as "productId", dc.remaining_qty as "remainingQty",
             dc.waste_qty as "wasteQty",
             dc.business_date as "businessDate", dc.created_at as "createdAt",
             u.name as "checkedByName"
      FROM daily_stock_checks dc
      LEFT JOIN users u ON u.id = dc.checked_by_user_id
      WHERE dc.store_id = ${storeId} AND dc.business_date = ${businessDate}::date
    `;
    return NextResponse.json(checks);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// POST — save/update today's check (upsert)
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { storeId: bodyStoreId, productId, remainingQty, wasteQty, pin } = await request.json();

    if (!productId || remainingQty === undefined || remainingQty === null) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }
    if (!pin || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "กรุณาระบุ PIN" }, { status: 400 });
    }

    const storeId = await resolveStoreId(user, bodyStoreId);
    if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

    // Verify PIN belongs to this store
    const pinResult = await verifyStorePin(storeId, pin);
    if (!pinResult.ok) {
      if (pinResult.reason === "locked") {
        const mins = Math.ceil(pinResult.retryAfterSeconds / 60);
        return NextResponse.json({ error: `ใส่ PIN ผิดหลายครั้งเกินไป กรุณาลองใหม่ในอีก ${mins} นาที` }, { status: 429 });
      }
      return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
    }
    const employee = pinResult.user;

    // Verify product belongs to this store
    const [product] = await sql`SELECT id FROM products WHERE id = ${productId} AND store_id = ${storeId}`;
    if (!product) return NextResponse.json({ error: "ไม่พบสินค้า" }, { status: 404 });

    const businessDate = await getCurrentBusinessDate(storeId);

    const [check] = await sql`
      INSERT INTO daily_stock_checks (product_id, store_id, remaining_qty, waste_qty, checked_by_user_id, business_date)
      VALUES (${productId}, ${storeId}, ${remainingQty}, ${wasteQty ?? 0}, ${employee.id}, ${businessDate}::date)
      ON CONFLICT (product_id, store_id, business_date)
      DO UPDATE SET remaining_qty = EXCLUDED.remaining_qty,
                    waste_qty = EXCLUDED.waste_qty,
                    checked_by_user_id = EXCLUDED.checked_by_user_id,
                    created_at = now()
      RETURNING id
    `;

    return NextResponse.json({ success: true, id: check.id });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
