import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const history = await sql`
      SELECT id, TO_CHAR(created_at, 'HH24:MI น.') as time, type,
             product_id as "itemName", qty, note, employee_pin as "user"
      FROM movements
      ORDER BY created_at DESC
      LIMIT 10
    `;
    return NextResponse.json(history);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
