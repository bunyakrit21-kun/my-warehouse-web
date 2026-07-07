import { NextResponse } from "next/server";
import { getUser, resolveStoreId } from "@/lib/auth";
import { getCashClosingExpected } from "@/lib/cashClosing";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  try {
    const data = await getCashClosingExpected(storeId);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
