import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";

const VALID_TYPES = ["income", "expense"];

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  try {
    const categories = await sql`
      SELECT id, name, type, icon, is_system as "isSystem"
      FROM transaction_categories
      WHERE store_id = ${storeId}
      ORDER BY is_system DESC, name ASC
    `;
    return NextResponse.json(categories);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  try {
    const { storeId: bodyStoreId, name, type, icon } = await request.json();

    if (!name || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }

    const storeId = await resolveStoreId(user, bodyStoreId);
    if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

    const [category] = await sql`
      INSERT INTO transaction_categories (store_id, name, type, icon)
      VALUES (${storeId}, ${name}, ${type}, ${icon || "tag"})
      RETURNING id, name, type, icon, is_system as "isSystem"
    `;
    return NextResponse.json(category, { status: 201 });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
