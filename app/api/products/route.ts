import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET() {
  try {
    // ใช้รูปแบบการเขียน SQL ที่ปลอดภัยสำหรับ postgres.js
    const products = await sql`
      SELECT 
        id, name, category, zone, 
        stock::int as stock, 
        min_stock::int as "minStock", 
        unit, image, 
        TO_CHAR(created_at, 'DD/MM/YYYY, HH24:MI') as "createdAt"
      FROM products
      ORDER BY created_at DESC
    `;
    
    return NextResponse.json(products);
  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, category, zone, stock, minStock, unit, image } = body;

    // ตรวจสอบชื่อคอลัมน์และตัวแปรให้ตรง
    const result = await sql`
      INSERT INTO products (id, name, category, zone, stock, min_stock, unit, image)
      VALUES (${id}, ${name}, ${category}, ${zone}, ${stock}, ${minStock}, ${unit}, ${image})
      RETURNING id, name
    `;

    return NextResponse.json({ success: true, product: result[0] });
  } catch (error) {
    console.error("Database Insert Error:", error);
    return NextResponse.json({ error: "บันทึกข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}