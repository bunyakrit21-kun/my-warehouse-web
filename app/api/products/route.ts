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
    const products = await sql`
      SELECT
        id, name, category, zone,
        stock::int as stock,
        min_stock::int as "minStock",
        unit, image,
        TO_CHAR(created_at, 'DD/MM/YYYY, HH24:MI') as "createdAt"
      FROM products
      WHERE store_id = ${storeId}
      ORDER BY created_at DESC
    `;
    return NextResponse.json(products);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { id, name, category, zone, stock, minStock, unit, image, storeId: bodyStoreId } = body;

    const storeId = await resolveStoreId(user, bodyStoreId);
    if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

    const result = await sql`
      INSERT INTO products (id, name, category, zone, stock, min_stock, unit, image, store_id)
      VALUES (${id}, ${name}, ${category}, ${zone}, ${stock}, ${minStock}, ${unit}, ${image ?? ""}, ${storeId})
      RETURNING id, name
    `;
    return NextResponse.json({ success: true, product: result[0] });
  } catch {
    return NextResponse.json({ error: "บันทึกข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}
