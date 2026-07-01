import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function POST(request: Request) {
  const loggedIn = await getUser();
  if (!loggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { pin, storeId } = await request.json();

    if (!pin || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 400 });
    }

    if (!storeId) {
      return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });
    }

    const [employee] = await sql`
      SELECT id, name, role FROM users
      WHERE pin = ${pin} AND active = true AND store_id = ${storeId}
    `;

    if (!employee) {
      return NextResponse.json({ error: "ไม่พบรหัสพนักงานนี้" }, { status: 404 });
    }

    return NextResponse.json({ name: employee.name, role: employee.role });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
