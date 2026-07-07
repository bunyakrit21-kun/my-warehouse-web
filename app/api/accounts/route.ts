import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";

const VALID_TYPES = ["cash", "bank", "e-wallet", "other"];

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  try {
    const accounts = await sql`
      SELECT id, name, account_type as "accountType", current_balance as "currentBalance", is_default_cash as "isDefaultCash"
      FROM accounts
      WHERE store_id = ${storeId} AND archived_at IS NULL
      ORDER BY is_default_cash DESC, created_at ASC
    `;
    return NextResponse.json(accounts);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  try {
    const { storeId: bodyStoreId, name, accountType } = await request.json();

    if (!name || !VALID_TYPES.includes(accountType)) {
      return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }

    const storeId = await resolveStoreId(user, bodyStoreId);
    if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

    const [account] = await sql`
      INSERT INTO accounts (store_id, name, account_type)
      VALUES (${storeId}, ${name}, ${accountType})
      RETURNING id, name, account_type as "accountType", current_balance as "currentBalance", is_default_cash as "isDefaultCash"
    `;
    return NextResponse.json(account, { status: 201 });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
