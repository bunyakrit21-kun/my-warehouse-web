import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET() {
  try {
    const stats = await sql`
      SELECT 
        (SELECT COUNT(*) FROM products) as total_items,
        (SELECT COUNT(*) FROM products WHERE stock <= min_stock) as critical_count
    `;
    return NextResponse.json(stats[0]);
  } catch (error) {
    return NextResponse.json({ error: "ดึงสถิติไม่ได้" }, { status: 500 });
  }
}