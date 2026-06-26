import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name } = await request.json();
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "ชื่อไม่ถูกต้อง" }, { status: 400 });
    }

    await sql`UPDATE users SET name = ${name.trim()} WHERE id = ${user.id}`;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
