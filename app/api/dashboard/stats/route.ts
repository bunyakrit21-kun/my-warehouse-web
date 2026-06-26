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
    const [stats] = await sql`
      SELECT
        COUNT(*) AS total_items,
        COUNT(*) FILTER (WHERE stock <= min_stock) AS critical_count
      FROM products
      WHERE store_id = ${storeId}
    `;
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ error: "ดึงสถิติไม่ได้" }, { status: 500 });
  }
}
