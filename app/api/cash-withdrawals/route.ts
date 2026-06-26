import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");

  try {
    const withdrawals = await sql`
      SELECT cw.id, cw.amount, cw.reason, cw.employee_pin, cw.created_at, u.name AS employee_name
      FROM cash_withdrawals cw
      LEFT JOIN users u ON u.pin = cw.employee_pin
      ${storeId ? sql`WHERE cw.store_id = ${storeId}` : sql``}
      ORDER BY cw.created_at DESC
      LIMIT 50
    `;
    return NextResponse.json(withdrawals);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { amount, reason, pin, storeId } = await request.json();

    if (!amount || Number(amount) <= 0 || !reason || !pin) {
      return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }

    const [user] = await sql`SELECT id, name FROM users WHERE pin = ${pin} AND active = true`;
    if (!user) {
      return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
    }

    await sql`
      INSERT INTO cash_withdrawals (store_id, amount, reason, employee_pin)
      VALUES (${storeId ?? null}, ${amount}, ${reason}, ${pin})
    `;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
