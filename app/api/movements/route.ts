import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser } from "@/lib/auth";

const VALID_TYPES = ["MOVE_IN", "MOVE_OUT"] as const;

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const movements = await sql`
      SELECT
        m.id,
        m.created_at,
        m.type,
        m.qty,
        m.note,
        m.employee_pin,
        p.name AS product_name,
        p.unit,
        u.name AS employee_name
      FROM movements m
      LEFT JOIN products p ON p.id = m.product_id
      LEFT JOIN users u ON u.pin = m.employee_pin
      ORDER BY m.created_at DESC
      LIMIT 50
    `;
    return NextResponse.json(movements);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { productId, type, qty, note, pin } = body;

    if (!productId || !qty || qty <= 0) {
      return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "ประเภทการเคลื่อนย้ายไม่ถูกต้อง" }, { status: 400 });
    }

    const result = await sql.begin(async (sql) => {
      const products = await sql`
        SELECT stock FROM products WHERE id = ${productId} FOR UPDATE
      `;

      if (products.length === 0) throw new Error("ไม่พบสินค้า");

      const product = products[0];

      if (type === "MOVE_OUT" && product.stock < qty) {
        throw new Error("สต็อกไม่เพียงพอสำหรับการเบิก");
      }

      await sql`
        INSERT INTO movements (product_id, employee_pin, type, qty, note)
        VALUES (${productId}, ${pin}, ${type}, ${qty}, ${note || ""})
      `;

      const change = type === "MOVE_IN" ? qty : -qty;
      await sql`
        UPDATE products SET stock = stock + ${change} WHERE id = ${productId}
      `;

      return { success: true };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const known = ["ไม่พบสินค้า", "สต็อกไม่เพียงพอสำหรับการเบิก"];
    const msg = known.includes(error.message) ? error.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
