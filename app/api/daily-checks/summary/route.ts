import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";
import { getCurrentBusinessDate } from "@/lib/businessDay";

// GET — admin summary: par level, today's remaining, suggested order, 7-day avg
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  try {
    const businessDate = await getCurrentBusinessDate(storeId);

    const rows = await sql`
      SELECT
        p.id,
        p.name,
        p.unit,
        p.image,
        p.par_level AS "parLevel",
        -- today's check
        today.remaining_qty AS "remainingToday",
        today.waste_qty AS "wasteToday",
        today.created_at AS "checkedAt",
        checker.name AS "checkedByName",
        -- avg of last 7 days with data (excluding today)
        hist.avg_remaining AS "avgRemaining"
      FROM products p
      LEFT JOIN daily_stock_checks today
        ON today.product_id = p.id AND today.store_id = p.store_id AND today.business_date = ${businessDate}::date
      LEFT JOIN users checker
        ON checker.id = today.checked_by_user_id
      LEFT JOIN LATERAL (
        SELECT ROUND(AVG(remaining_qty)::numeric, 1) AS avg_remaining
        FROM (
          SELECT remaining_qty FROM daily_stock_checks
          WHERE product_id = p.id AND store_id = ${storeId}
            AND business_date < ${businessDate}::date
          ORDER BY business_date DESC LIMIT 7
        ) recent
      ) hist ON true
      WHERE p.store_id = ${storeId} AND p.is_fresh = true
      ORDER BY p.name
    `;

    const summary = rows.map(r => ({
      ...r,
      suggestOrder: r.parLevel !== null && r.remainingToday !== null
        ? Math.max(0, Number(r.parLevel) - Number(r.remainingToday))
        : null,
    }));

    return NextResponse.json(summary);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
