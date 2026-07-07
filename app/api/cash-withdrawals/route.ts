import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";
import { getCurrentBusinessDate } from "@/lib/businessDay";
import { verifyStorePin } from "@/lib/pin";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  try {
    const withdrawals = await sql`
      SELECT cw.id, cw.amount, cw.reason, cw.created_at,
             u.name AS employee_name
      FROM cash_withdrawals cw
      LEFT JOIN users u ON u.id = cw.user_id
      WHERE cw.store_id = ${storeId}
      ORDER BY cw.created_at DESC
      LIMIT 50
    `;
    return NextResponse.json(withdrawals);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { amount, reason, pin, storeId: bodyStoreId } = await request.json();

    if (!amount || Number(amount) <= 0 || !reason || !pin) {
      return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
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

    const businessDate = await getCurrentBusinessDate(storeId);

    await sql`
      INSERT INTO cash_withdrawals (store_id, amount, reason, user_id, business_date)
      VALUES (${storeId}, ${amount}, ${reason}, ${employee.id}, ${businessDate})
    `;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
