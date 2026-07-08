import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";
import { getCurrentBusinessDate } from "@/lib/businessDay";

const VALID_TYPES = ["income", "expense", "transfer"];

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const storeId = await resolveStoreId(user, searchParams.get("storeId"));
  if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    const rows = await sql`
      SELECT t.id, t.type, t.amount, t.note, t.business_date as "businessDate",
             t.source, t.created_at as "createdAt",
             a.name as "accountName",
             ta.name as "transferToAccountName",
             t.category_id as "categoryId", c.name as "categoryName", c.type as "categoryType",
             u.name as "createdByName"
      FROM transactions t
      LEFT JOIN accounts a ON a.id = t.account_id
      LEFT JOIN accounts ta ON ta.id = t.transfer_to_account_id
      LEFT JOIN transaction_categories c ON c.id = t.category_id
      LEFT JOIN users u ON u.id = t.created_by
      WHERE t.store_id = ${storeId}
        ${from ? sql`AND t.business_date >= ${from}::date` : sql``}
        ${to ? sql`AND t.business_date <= ${to}::date` : sql``}
      ORDER BY t.business_date DESC, t.created_at DESC
      LIMIT 200
    `;
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  try {
    const {
      storeId: bodyStoreId, accountId, type, amount, categoryId, transferToAccountId, note,
    } = await request.json();

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "ประเภทไม่ถูกต้อง" }, { status: 400 });
    }
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "กรุณากรอกจำนวนเงิน" }, { status: 400 });
    }
    if (!accountId) {
      return NextResponse.json({ error: "กรุณาเลือกบัญชี" }, { status: 400 });
    }
    if ((type === "income" || type === "expense") && !categoryId) {
      return NextResponse.json({ error: "กรุณาเลือกหมวดหมู่" }, { status: 400 });
    }
    if (type === "transfer" && (!transferToAccountId || transferToAccountId === accountId)) {
      return NextResponse.json({ error: "กรุณาเลือกบัญชีปลายทางที่ไม่ใช่บัญชีเดียวกัน" }, { status: 400 });
    }

    const storeId = await resolveStoreId(user, bodyStoreId);
    if (!storeId) return NextResponse.json({ error: "กรุณาระบุร้าน" }, { status: 400 });

    const businessDate = await getCurrentBusinessDate(storeId);
    const amountNum = Number(amount);

    const result = await sql.begin(async (sql) => {
      const [account] = await sql`
        SELECT id, current_balance FROM accounts
        WHERE id = ${accountId} AND store_id = ${storeId} AND archived_at IS NULL
        FOR UPDATE
      `;
      if (!account) throw new Error("ไม่พบบัญชี");

      if (type === "income" || type === "expense") {
        const [category] = await sql`
          SELECT id FROM transaction_categories WHERE id = ${categoryId} AND store_id = ${storeId} AND type = ${type}
        `;
        if (!category) throw new Error("ไม่พบหมวดหมู่");

        const delta = type === "income" ? amountNum : -amountNum;
        await sql`UPDATE accounts SET current_balance = current_balance + ${delta} WHERE id = ${accountId}`;

        const [tx] = await sql`
          INSERT INTO transactions (store_id, account_id, category_id, type, amount, note, business_date, source, created_by)
          VALUES (${storeId}, ${accountId}, ${categoryId}, ${type}, ${amountNum}, ${note ?? null}, ${businessDate}::date, 'manual', ${user.id})
          RETURNING id
        `;
        return { id: tx.id };
      }

      // transfer
      const [toAccount] = await sql`
        SELECT id FROM accounts WHERE id = ${transferToAccountId} AND store_id = ${storeId} AND archived_at IS NULL
        FOR UPDATE
      `;
      if (!toAccount) throw new Error("ไม่พบบัญชีปลายทาง");

      await sql`UPDATE accounts SET current_balance = current_balance - ${amountNum} WHERE id = ${accountId}`;
      await sql`UPDATE accounts SET current_balance = current_balance + ${amountNum} WHERE id = ${transferToAccountId}`;

      const [tx] = await sql`
        INSERT INTO transactions (store_id, account_id, transfer_to_account_id, type, amount, note, business_date, source, created_by)
        VALUES (${storeId}, ${accountId}, ${transferToAccountId}, 'transfer', ${amountNum}, ${note ?? null}, ${businessDate}::date, 'manual', ${user.id})
        RETURNING id
      `;
      return { id: tx.id };
    });

    return NextResponse.json({ success: true, id: result.id }, { status: 201 });
  } catch (error) {
    const known = ["ไม่พบบัญชี", "ไม่พบหมวดหมู่", "ไม่พบบัญชีปลายทาง"];
    const message = error instanceof Error ? error.message : "";
    const msg = known.includes(message) ? message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
