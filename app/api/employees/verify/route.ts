import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();

    if (!pin || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 400 });
    }

    const [user] = await sql`
      SELECT id, name, role FROM users WHERE pin = ${pin} AND active = true
    `;

    if (!user) {
      return NextResponse.json({ error: "ไม่พบรหัสพนักงานนี้" }, { status: 404 });
    }

    return NextResponse.json({ name: user.name, role: user.role });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}