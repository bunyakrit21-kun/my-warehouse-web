import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET() {
  try {
    // ดึงข้อมูลการเคลื่อนไหวล่าสุดจากตาราง movements
    const history = await sql`
      SELECT id, TO_CHAR(created_at, 'HH24:MI น.') as time, type, 
             product_id as "itemName", qty, note, employee_pin as "user"
      FROM movements
      ORDER BY created_at DESC
      LIMIT 10
    `;
    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json({ error: "ดึงข้อมูลประวัติไม่ได้" }, { status: 500 });
  }
}