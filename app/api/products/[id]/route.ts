import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { name, category, zone, stock, minStock, unit, image } = await request.json();
    await sql`
      UPDATE products 
      SET name = ${name}, category = ${category}, zone = ${zone},
          stock = ${stock}, min_stock = ${minStock}, unit = ${unit}, image = ${image}
      WHERE id = ${id}
    `;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await sql`DELETE FROM products WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}