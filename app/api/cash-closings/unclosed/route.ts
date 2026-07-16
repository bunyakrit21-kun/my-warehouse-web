import { NextResponse } from "next/server";
import { getUser, resolveStoreId } from "@/lib/auth";
import { getUnclosedDays } from "@/lib/cashClosing";

// รายการวันค้างปิดยอด (ใช้แสดง banner เตือน + ให้เจ้าของเคลียร์)
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  const days = await getUnclosedDays(storeId);
  return NextResponse.json({ days });
}
