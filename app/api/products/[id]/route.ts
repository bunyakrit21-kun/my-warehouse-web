import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";

async function verifyProductAccess(user: Awaited<ReturnType<typeof getUser>>, productId: string) {
  if (!user) return null;
  const [product] = await sql`SELECT store_id FROM products WHERE id = ${productId}`;
  if (!product) return null;
  const storeId = await resolveStoreId(user, String(product.store_id));
  return storeId ? product.store_id : null;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeId = await verifyProductAccess(user, id);
  if (!storeId) return NextResponse.json({ error: "ไม่พบสินค้าหรือไม่มีสิทธิ์จัดการ" }, { status: 403 });

  try {
    const { name, category, zone, stock, minStock, unit, image } = await request.json();
    await sql`
      UPDATE products
      SET name = ${name}, category = ${category}, zone = ${zone},
          stock = ${stock}, min_stock = ${minStock}, unit = ${unit}, image = ${image}
      WHERE id = ${id} AND store_id = ${storeId}
    `;
    return NextResponse.json({ success: true });
  } catch {
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
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
