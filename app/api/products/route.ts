import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";
import { createThumbnail } from "@/lib/image-thumbnail";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  try {
    // Return image_thumbnail (a few KB) here, not the full-size image column
    // (often 50-300KB) — list responses shouldn't ship N * 100KB of JSON.
    // Full-resolution photos are only needed when editing a single product.
    const products = await sql`
      SELECT
        id, name, category, zone,
        stock::int as stock,
        min_stock::int as "minStock",
        unit,
        COALESCE(image_thumbnail, image) as image,
        COALESCE(is_fresh, false) as "isFresh",
        par_level as "parLevel",
        TO_CHAR(created_at, 'DD/MM/YYYY, HH24:MI') as "createdAt"
      FROM products
      WHERE store_id = ${storeId}
      ORDER BY created_at DESC
    `;
    return NextResponse.json(products);
  } catch (err) {
    console.error("GET /api/products error:", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { name, category, zone, stock, minStock, unit, image, storeId: bodyStoreId, isFresh, parLevel } = body;

    const storeId = await resolveStoreId(user, bodyStoreId);
    if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

    const imageThumbnail = image ? await createThumbnail(image) : "";

    const [product] = await sql`
      INSERT INTO products (id, name, category, zone, stock, min_stock, unit, image, image_thumbnail, store_id, is_fresh, par_level)
      VALUES ('PROD' || LPAD(nextval('products_id_seq')::text, 3, '0'), ${name}, ${category}, ${zone}, ${stock}, ${minStock}, ${unit}, ${image ?? ""}, ${imageThumbnail}, ${storeId}, ${isFresh ?? false}, ${parLevel ?? null})
      RETURNING id, name
    `;

    return NextResponse.json({ success: true, product });
  } catch (err) {
    console.error("POST /api/products error:", err);
    return NextResponse.json({ error: "บันทึกข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}
