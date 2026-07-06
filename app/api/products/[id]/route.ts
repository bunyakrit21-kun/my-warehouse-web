import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";
import { createThumbnail } from "@/lib/image-thumbnail";

async function verifyProductAccess(user: Awaited<ReturnType<typeof getUser>>, productId: string) {
  if (!user) return null;
  const [product] = await sql`SELECT store_id FROM products WHERE id = ${productId}`;
  if (!product) return null;
  const storeId = await resolveStoreId(user, String(product.store_id));
  return storeId ? product.store_id : null;
}

// Full-resolution image lookup for a single product — the list endpoint
// (GET /api/products) only returns a small thumbnail, so edit flows must
// fetch the real photo here before prefilling the form, otherwise saving
// without changing the photo would permanently downgrade it to thumbnail quality.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeId = await verifyProductAccess(user, id);
  if (!storeId) return NextResponse.json({ error: "ไม่พบสินค้าหรือไม่มีสิทธิ์จัดการ" }, { status: 403 });

  try {
    const [product] = await sql`
      SELECT
        id, name, category, zone,
        stock::int as stock,
        min_stock::int as "minStock",
        unit, image,
        COALESCE(is_fresh, false) as "isFresh",
        par_level as "parLevel"
      FROM products
      WHERE id = ${id} AND store_id = ${storeId}
    `;
    if (!product) return NextResponse.json({ error: "ไม่พบสินค้า" }, { status: 404 });
    return NextResponse.json(product);
  } catch (err) {
    console.error("GET /api/products/[id] error:", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeId = await verifyProductAccess(user, id);
  if (!storeId) return NextResponse.json({ error: "ไม่พบสินค้าหรือไม่มีสิทธิ์จัดการ" }, { status: 403 });

  try {
    const { name, category, zone, stock, minStock, unit, image, isFresh, parLevel } = await request.json();
    const imageThumbnail = image ? await createThumbnail(image) : "";
    await sql`
      UPDATE products
      SET name = ${name}, category = ${category}, zone = ${zone},
          stock = ${stock}, min_stock = ${minStock}, unit = ${unit}, image = ${image},
          image_thumbnail = ${imageThumbnail},
          is_fresh = ${isFresh ?? false}, par_level = ${parLevel ?? null}
      WHERE id = ${id} AND store_id = ${storeId}
    `;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/products/[id] error:", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeId = await verifyProductAccess(user, id);
  if (!storeId) return NextResponse.json({ error: "ไม่พบสินค้าหรือไม่มีสิทธิ์จัดการ" }, { status: 403 });

  try {
    await sql`DELETE FROM products WHERE id = ${id} AND store_id = ${storeId}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/products/[id] error:", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
