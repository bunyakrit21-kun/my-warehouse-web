import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  try {
    const withdrawals = await sql`
      SELECT cw.id, cw.amount, cw.reason, cw.employee_pin, cw.created_at, u.name AS employee_name
      FROM cash_withdrawals cw
      LEFT JOIN users u ON u.pin = cw.employee_pin
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

    const [employee] = await sql`SELECT id FROM users WHERE pin = ${pin} AND active = true`;
    if (!employee) {
      return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
    }

    await sql`
      INSERT INTO cash_withdrawals (store_id, amount, reason, employee_pin)
      VALUES (${storeId}, ${amount}, ${reason}, ${pin})
    `;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
