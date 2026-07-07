import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const stores = await sql`
      SELECT DISTINCT s.id, s.name, s.business_type, s.phone, s.created_at, s.country,
        s.business_day_start_time, s.business_day_end_time, s.logo_thumbnail,
        CASE WHEN s.owner_id = ${user.id} THEN 'owner' ELSE sm.role END AS my_role
      FROM stores s
      LEFT JOIN store_members sm ON sm.store_id = s.id AND sm.user_id = ${user.id}
      WHERE s.owner_id = ${user.id} OR sm.user_id = ${user.id}
      ORDER BY s.created_at ASC
    `;
    return NextResponse.json(stores);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, business_type, phone } = await request.json();
    if (!name) return NextResponse.json({ error: "กรุณาระบุชื่อร้าน" }, { status: 400 });

    const [store] = await sql`
      INSERT INTO stores (owner_id, name, business_type, phone)
      VALUES (${user.id}, ${name}, ${business_type ?? "ร้านอาหาร"}, ${phone ?? ""})
      RETURNING id, name, business_type, phone, created_at
    `;
    return NextResponse.json(store, { status: 201 });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}