import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";
import { hashPin, findUserByPin } from "@/lib/pin";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "ต้องระบุร้าน" }, { status: 400 });

  const resolvedStoreId = await resolveStoreId(user, storeId);
  if (!resolvedStoreId) return NextResponse.json({ error: "ไม่มีสิทธิ์ดูข้อมูลร้านนี้" }, { status: 403 });

  try {
    const members = await sql`
      SELECT id, name, role FROM users
      WHERE active = true AND store_id = ${resolvedStoreId}
      ORDER BY name ASC
    `;
    return NextResponse.json(members);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  try {
    const { name, pin, role, storeId } = await request.json();

    if (!name || !/^\d{4}$/.test(pin) || !storeId) {
      return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }

    const existing = await findUserByPin(storeId, pin);
    if (existing) {
      return NextResponse.json({ error: "PIN นี้ถูกใช้งานแล้วในร้านนี้" }, { status: 400 });
    }

    const hashedPin = await hashPin(pin);
    const [member] = await sql`
      INSERT INTO users (name, role, pin, store_id, active)
      VALUES (${name}, ${role ?? "staff"}, ${hashedPin}, ${storeId}, true)
      RETURNING id, name, role
    `;
    return NextResponse.json(member, { status: 201 });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
