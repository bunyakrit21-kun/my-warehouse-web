import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const stores = await sql`SELECT id, name, business_type FROM stores ORDER BY name ASC`;
    return NextResponse.json(stores);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
