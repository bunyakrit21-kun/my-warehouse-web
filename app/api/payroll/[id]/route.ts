import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getUser, resolveStoreId } from "@/lib/auth";
import type postgres from "postgres";
import { computePayroll, type PayrollLineInput } from "@/lib/payroll";

async function loadPeriod(userId: number, periodId: string) {
  const [period] = await sql`SELECT * FROM payroll_periods WHERE id = ${periodId}`;
  if (!period) return { error: "ไม่พบงวด", status: 404 as const };
  const [store] = await sql`SELECT id FROM stores WHERE id = ${period.store_id} AND owner_id = ${userId}`;
  if (!store) return { error: "ไม่มีสิทธิ์เข้าถึงงวดนี้", status: 403 as const };
  return { period };
}

// รายละเอียดงวด: ข้อมูลงวด + ทุกพนักงานในร้าน (รวมคนที่ยังไม่มีบรรทัด ดึงค่าตั้งต้นจาก users)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  const res = await loadPeriod(user.id, id);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  const p = res.period;

  const rows = await sql`
    SELECT u.id AS "userId", u.name, u.duty,
           COALESCE(l.pay_type, u.pay_type, 'monthly') AS "payType",
           COALESCE(l.hours, 0) AS hours,
           COALESCE(l.monthly_amount, u.monthly_salary, 0) AS "monthlyAmount",
           COALESCE(l.hourly_rate, u.hourly_rate, 0) AS "hourlyRate",
           COALESCE(l.base_pay, 0) AS "basePay",
           COALESCE(l.tip_amount, 0) AS "tipAmount",
           l.note
    FROM users u
    LEFT JOIN payroll_lines l ON l.user_id = u.id AND l.period_id = ${id}
    WHERE u.store_id = ${p.store_id} AND u.active = true
    ORDER BY u.name
  `;

  return NextResponse.json({
    id: p.id, name: p.name,
    startDate: p.start_date, endDate: p.end_date,
    tipPool: Number(p.tip_pool), status: p.status,
    lines: rows,
  });
}

// บันทึกบรรทัด / ปิดงวด (จ่าย → ลงบัญชี) / เปิดงวดใหม่
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  const res = await loadPeriod(user.id, id);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  const p = res.period;

  try {
    const body = await request.json();
    const action: string = body.action ?? "save";

    if (action === "reopen") {
      // ถอนรายการบัญชีเงินเดือนของงวดนี้ แล้วกลับเป็นแบบร่าง
      await sql.begin(async (sql) => {
        await revertPayrollLedger(sql, Number(id));
        await sql`UPDATE payroll_periods SET status = 'draft', paid_at = NULL WHERE id = ${id}`;
      });
      return NextResponse.json({ success: true });
    }

    // save / finalize — คำนวณจาก input แล้ว upsert
    const tipPool = body.tipPool !== undefined ? Number(body.tipPool) || 0 : Number(p.tip_pool);
    const inputs: PayrollLineInput[] = Array.isArray(body.lines) ? body.lines.map((l: Record<string, unknown>) => ({
      userId: Number(l.userId),
      payType: l.payType === "hourly" ? "hourly" : "monthly",
      hours: Number(l.hours) || 0,
      monthlyAmount: Number(l.monthlyAmount) || 0,
      hourlyRate: Number(l.hourlyRate) || 0,
    })) : [];

    const computed = computePayroll(inputs, tipPool);
    const notes: Record<number, string | null> = {};
    if (Array.isArray(body.lines)) for (const l of body.lines) notes[Number(l.userId)] = (l.note as string) || null;

    await sql.begin(async (sql) => {
      await sql`UPDATE payroll_periods SET tip_pool = ${tipPool} WHERE id = ${id}`;
      for (const c of computed) {
        // อัปเดตค่าตั้งต้นบน users ให้ครั้งหน้าไม่ต้องกรอกซ้ำ
        await sql`
          UPDATE users SET pay_type = ${c.payType},
            monthly_salary = ${c.monthlyAmount}, hourly_rate = ${c.hourlyRate}
          WHERE id = ${c.userId} AND store_id = ${p.store_id}
        `;
        await sql`
          INSERT INTO payroll_lines (period_id, user_id, pay_type, hours, monthly_amount, hourly_rate, base_pay, tip_amount, note)
          VALUES (${id}, ${c.userId}, ${c.payType}, ${c.hours}, ${c.monthlyAmount}, ${c.hourlyRate}, ${c.basePay}, ${c.tipAmount}, ${notes[c.userId] ?? null})
          ON CONFLICT (period_id, user_id) DO UPDATE SET
            pay_type = EXCLUDED.pay_type, hours = EXCLUDED.hours,
            monthly_amount = EXCLUDED.monthly_amount, hourly_rate = EXCLUDED.hourly_rate,
            base_pay = EXCLUDED.base_pay, tip_amount = EXCLUDED.tip_amount, note = EXCLUDED.note
        `;
      }

      if (action === "finalize") {
        if (p.status === "paid") throw new Error("งวดนี้ปิดจ่ายไปแล้ว");
        const totalBase = computed.reduce((s, c) => s + c.basePay, 0);
        await postPayrollLedger(sql, p.store_id, Number(id), p.name, totalBase, String(p.end_date), user.id);
        await sql`UPDATE payroll_periods SET status = 'paid', paid_at = now() WHERE id = ${id}`;
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error && error.message === "งวดนี้ปิดจ่ายไปแล้ว" ? error.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  const res = await loadPeriod(user.id, id);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });

  try {
    await sql.begin(async (sql) => {
      await revertPayrollLedger(sql, Number(id));
      await sql`DELETE FROM payroll_periods WHERE id = ${id}`; // lines cascade
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// --- ledger helpers (เงินเดือนลงบัญชีเป็นรายจ่าย; ทิปไม่ลง) ---
type Tx = postgres.TransactionSql<Record<string, unknown>>;

async function postPayrollLedger(tx: Tx, storeId: number, periodId: number, periodName: string, totalBase: number, businessDate: string, actorId: number) {
  if (totalBase <= 0) return;
  const [cash] = await tx`
    SELECT id FROM accounts WHERE store_id = ${storeId} AND is_default_cash = true AND archived_at IS NULL FOR UPDATE
  `;
  if (!cash) return;
  const [category] = await tx`
    SELECT id FROM transaction_categories WHERE store_id = ${storeId} AND type = 'expense' AND name = 'เงินเดือนพนักงาน' LIMIT 1
  `;
  const catId = category?.id ?? (await tx`
    INSERT INTO transaction_categories (store_id, name, type, icon, is_system) VALUES (${storeId}, 'เงินเดือนพนักงาน', 'expense', 'users', true) RETURNING id
  `)[0].id;

  await tx`UPDATE accounts SET current_balance = current_balance - ${totalBase} WHERE id = ${cash.id}`;
  await tx`
    INSERT INTO transactions (store_id, account_id, category_id, type, amount, business_date, source, source_ref_id, created_by, note)
    VALUES (${storeId}, ${cash.id}, ${catId}, 'expense', ${totalBase}, ${businessDate}::date, 'payroll', ${periodId}, ${actorId}, ${'เงินเดือนงวด ' + periodName})
  `;
}

async function revertPayrollLedger(tx: Tx, periodId: number) {
  const linked = await tx`SELECT id, amount, account_id FROM transactions WHERE source = 'payroll' AND source_ref_id = ${periodId} FOR UPDATE`;
  for (const t of linked) {
    await tx`UPDATE accounts SET current_balance = current_balance + ${Number(t.amount)} WHERE id = ${t.account_id}`;
    await tx`DELETE FROM transaction_edit_history WHERE transaction_id = ${t.id}`;
    await tx`DELETE FROM transactions WHERE id = ${t.id}`;
  }
}
