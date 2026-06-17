import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "today";

  // กำหนดช่วงเวลา
  const interval = range === "week" ? "7 days" : range === "month" ? "30 days" : "1 day";

  const [summary, topProducts, dailyTrend] = await Promise.all([

    // 1. สรุปภาพรวม
    sql`
      SELECT
        COUNT(*) FILTER (WHERE type = 'MOVE_IN') AS total_in,
        COUNT(*) FILTER (WHERE type = 'MOVE_OUT') AS total_out,
        COALESCE(SUM(qty) FILTER (WHERE type = 'MOVE_IN'), 0) AS volume_in,
        COALESCE(SUM(qty) FILTER (WHERE type = 'MOVE_OUT'), 0) AS volume_out,
        COUNT(*) AS total_movements
      FROM movements
      WHERE created_at >= NOW() - ${interval}::interval
    `,

    // 2. Top 5 สินค้าที่เบิกบ่อยที่สุด
    sql`
      SELECT 
        p.name,
        SUM(m.qty) FILTER (WHERE m.type = 'MOVE_IN') AS total_in,
        SUM(m.qty) FILTER (WHERE m.type = 'MOVE_OUT') AS total_out,
        COUNT(*) AS total_movements
      FROM movements m
      JOIN products p ON p.id = m.product_id
      WHERE m.created_at >= NOW() - ${interval}::interval
      GROUP BY p.id, p.name
      ORDER BY total_movements DESC
      LIMIT 5
    `,

    // 3. Trend รายวัน 7 วันล่าสุด
    sql`
      SELECT
        DATE(created_at) AS date,
        COALESCE(SUM(qty) FILTER (WHERE type = 'MOVE_IN'), 0) AS volume_in,
        COALESCE(SUM(qty) FILTER (WHERE type = 'MOVE_OUT'), 0) AS volume_out
      FROM movements
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,
  ]);

  return NextResponse.json({
    summary: summary[0],
    topProducts,
    dailyTrend,
  });
}