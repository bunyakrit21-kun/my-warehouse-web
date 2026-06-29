import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const stores = await sql`
      SELECT DISTINCT s.id, s.name, s.business_type
      FROM stores s
      LEFT JOIN store_members sm ON sm.store_id = s.id AND sm.user_id = ${user.id}
      WHERE s.owner_id = ${user.id} OR sm.user_id = ${user.id}
      ORDER BY s.name ASC
    `;
    return NextResponse.json(stores);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
