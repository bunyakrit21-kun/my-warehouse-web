import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import sql from "@/lib/db";

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as any;
  } catch {
    return null;
  }
}

// GET — ดึงร้านทั้งหมดที่ user นี้เป็นเจ้าของหรือเป็นสมาชิก
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stores = await sql`
    SELECT DISTINCT s.id, s.name, s.business_type, s.phone, s.created_at,
      CASE WHEN s.owner_id = ${user.id} THEN 'owner' ELSE sm.role END AS my_role
    FROM stores s
    LEFT JOIN store_members sm ON sm.store_id = s.id AND sm.user_id = ${user.id}
    WHERE s.owner_id = ${user.id} OR sm.user_id = ${user.id}
    ORDER BY s.created_at ASC
  `;

  return NextResponse.json(stores);
}

// POST — สร้างร้านใหม่
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, business_type, phone } = await request.json();
  if (!name) return NextResponse.json({ error: "กรุณาระบุชื่อร้าน" }, { status: 400 });

  const [store] = await sql`
    INSERT INTO stores (owner_id, name, business_type, phone)
    VALUES (${user.id}, ${name}, ${business_type ?? "ร้านอาหาร"}, ${phone ?? ""})
    RETURNING id, name, business_type, phone, created_at
  `;

  return NextResponse.json(store, { status: 201 });
}