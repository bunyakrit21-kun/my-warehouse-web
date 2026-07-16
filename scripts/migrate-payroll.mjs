/**
 * เงินเดือน + ทิป: ค่าตั้งต้นเงินเดือนของพนักงาน (users.pay_type/monthly_salary/hourly_rate),
 * ตาราง payroll_periods + payroll_lines, และเปิด source='payroll' ให้ transactions
 * (Applied to production Supabase on 2026-07-09 via MCP; kept for other environments.)
 *
 * Usage: node scripts/migrate-payroll.mjs
 */
import fs from "fs";
import postgres from "postgres";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const match = env.match(/^DATABASE_URL=(.*)$/m);
let dbUrl = match[1].trim();
if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) dbUrl = dbUrl.slice(1, -1);
const sql = postgres(dbUrl, { ssl: "require", max: 1 });

async function main() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pay_type TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC`;
  await sql`
    CREATE TABLE IF NOT EXISTS payroll_periods (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      name TEXT NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL,
      tip_pool NUMERIC NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','paid')),
      paid_at TIMESTAMPTZ, created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_payroll_periods_store ON payroll_periods(store_id, start_date)`;
  await sql`
    CREATE TABLE IF NOT EXISTS payroll_lines (
      id SERIAL PRIMARY KEY,
      period_id INTEGER NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pay_type TEXT NOT NULL DEFAULT 'monthly' CHECK (pay_type IN ('monthly','hourly')),
      hours NUMERIC NOT NULL DEFAULT 0, monthly_amount NUMERIC NOT NULL DEFAULT 0,
      hourly_rate NUMERIC NOT NULL DEFAULT 0, base_pay NUMERIC NOT NULL DEFAULT 0,
      tip_amount NUMERIC NOT NULL DEFAULT 0, note TEXT,
      UNIQUE (period_id, user_id)
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_payroll_lines_period ON payroll_lines(period_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_payroll_lines_user ON payroll_lines(user_id)`;
  await sql`ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE payroll_lines ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_source_check`;
  await sql`ALTER TABLE transactions ADD CONSTRAINT transactions_source_check
    CHECK (source::text = ANY (ARRAY['manual','cash_closing','cash_closing_dayclose','cash_withdrawal','payroll']))`;
  console.log("Migration complete.");
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
