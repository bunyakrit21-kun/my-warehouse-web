import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "week";
  const interval = range === "month" ? "30 days" : range === "today" ? "1 day" : "7 days";

  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  try {
    const [summary, cashSummary, topProducts, dailyTrend] = await Promise.all([

      sql`
        SELECT
          COUNT(*) FILTER (WHERE type = 'MOVE_IN') AS total_in,
          COUNT(*) FILTER (WHERE type = 'MOVE_OUT') AS total_out,
          COALESCE(SUM(qty) FILTER (WHERE type = 'MOVE_IN'), 0) AS volume_in,
          COALESCE(SUM(qty) FILTER (WHERE type = 'MOVE_OUT'), 0) AS volume_out,
          COUNT(*) AS total_movements
        FROM movements
        WHERE store_id = ${storeId}
        AND created_at >= NOW() - ${interval}::interval
      `,

      sql`
        SELECT
          COUNT(*) AS total_withdrawals,
          COALESCE(SUM(amount), 0) AS total_amount
        FROM cash_withdrawals
        WHERE store_id = ${storeId}
        AND created_at >= NOW() - ${interval}::interval
      `,

      sql`
        SELECT
          p.name,
          COALESCE(SUM(m.qty) FILTER (WHERE m.type = 'MOVE_IN'), 0) AS total_in,
          COALESCE(SUM(m.qty) FILTER (WHERE m.type = 'MOVE_OUT'), 0) AS total_out,
          COUNT(*) AS total_movements
        FROM movements m
        JOIN products p ON p.id = m.product_id
        WHERE m.store_id = ${storeId}
        AND m.created_at >= NOW() - ${interval}::interval
        GROUP BY p.id, p.name
        ORDER BY total_movements DESC
        LIMIT 5
      `,

      sql`
        SELECT
          DATE(created_at) AS date,
          COALESCE(SUM(qty) FILTER (WHERE type = 'MOVE_IN'), 0) AS volume_in,
          COALESCE(SUM(qty) FILTER (WHERE type = 'MOVE_OUT'), 0) AS volume_out
        FROM movements
        WHERE store_id = ${storeId}
        AND created_at >= NOW() - ${interval}::interval
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
    ]);

    return NextResponse.json({
      summary: summary[0],
      cashSummary: cashSummary[0],
      topProducts,
      dailyTrend,
    });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
