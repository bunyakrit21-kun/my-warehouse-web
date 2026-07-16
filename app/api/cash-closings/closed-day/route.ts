import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";

// ทำเครื่องหมาย "ร้านปิด/วันหยุด" ให้วันหนึ่ง — เจ้าของร้านเท่านั้น (ไม่ลงบัญชี)
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "manager") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  try {
    const { storeId: bodyStoreId, businessDate, reason } = await request.json();
    const storeId = await resolveStoreId(user, bodyStoreId);
    if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });
    if (!businessDate || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง" }, { status: 400 });
    }
    await sql`
      INSERT INTO store_closed_days (store_id, business_date, reason, marked_by)
      VALUES (${storeId}, ${businessDate}::date, ${reason || null}, ${user.id})
      ON CONFLICT (store_id, business_date) DO UPDATE SET reason = EXCLUDED.reason
    `;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ยกเลิกเครื่องหมายวันหยุด
export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "manager") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  try {
    const { storeId: bodyStoreId, businessDate } = await request.json();
    const storeId = await resolveStoreId(user, bodyStoreId);
    if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });
    await sql`DELETE FROM store_closed_days WHERE store_id = ${storeId} AND business_date = ${businessDate}::date`;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
