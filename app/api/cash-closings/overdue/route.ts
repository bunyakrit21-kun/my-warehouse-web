import { NextResponse } from "next/server";
import { getUser, resolveStoreId } from "@/lib/auth";
import { getOverdueShiftInfo } from "@/lib/cashClosing";

// Lets the movement/cash-closing screens show a "count the drawer" reminder once a
// shift's scheduled end_time has passed with no closing done for it yet.
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  try {
    const info = await getOverdueShiftInfo(storeId);
    return NextResponse.json(info);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
