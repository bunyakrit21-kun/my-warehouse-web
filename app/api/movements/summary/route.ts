import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";
import { getCurrentBusinessDate } from "@/lib/businessDay";

const DAY_TH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  const days = Math.min(Math.max(Number(searchParams.get("days") ?? "6"), 1), 30);

  try {
    const today = await getCurrentBusinessDate(storeId);
    const startDate = addDays(today, -(days - 1));

    const rows = await sql`
      SELECT business_date::text AS date, type, COUNT(*)::int AS cnt
      FROM movements
      WHERE store_id = ${storeId}
        AND business_date >= ${startDate}::date
        AND business_date <= ${today}::date
      GROUP BY business_date, type
    `;

    const byDate = new Map<string, { in: number; out: number }>();
    for (const row of rows) {
      const entry = byDate.get(row.date) ?? { in: 0, out: 0 };
      if (row.type === "MOVE_IN") entry.in = row.cnt;
      else if (row.type === "MOVE_OUT") entry.out = row.cnt;
      byDate.set(row.date, entry);
    }

    const result = Array.from({ length: days }, (_, i) => {
      const date = addDays(startDate, i);
      const entry = byDate.get(date) ?? { in: 0, out: 0 };
      const isToday = date === today;
      const label = isToday ? "วันนี้" : DAY_TH[new Date(`${date}T00:00:00Z`).getUTCDay()];
      return { date, label, isToday, in: entry.in, out: entry.out };
    });

    const todayEntry = result[result.length - 1];
    return NextResponse.json({ days: result, todayIn: todayEntry.in, todayOut: todayEntry.out });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
