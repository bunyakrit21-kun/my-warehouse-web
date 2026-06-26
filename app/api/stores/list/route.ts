import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET() {
  const stores = await sql`SELECT id, name, business_type FROM stores ORDER BY name ASC`;
  return NextResponse.json(stores);
}