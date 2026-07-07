/**
 * Creates cash_closings (spec-04 Phase 1: cash closing system).
 * Integer serial PK to match this codebase's existing tables (stores/movements/
 * cash_withdrawals/daily_stock_checks all use serial ids, not UUID).
 *
 * Usage: node scripts/migrate-cash-closings.mjs
 */

import fs from "fs";
import postgres from "postgres";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const match = env.match(/^DATABASE_URL=(.*)$/m);
let dbUrl = match[1].trim();
if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
  dbUrl = dbUrl.slice(1, -1);
}

const sql = postgres(dbUrl, { ssl: "require", max: 1 });

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS cash_closings (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL REFERENCES stores(id),
      shift_id INTEGER REFERENCES shifts(id),
      business_date DATE NOT NULL,
      opening_float NUMERIC NOT NULL DEFAULT 0,
      cash_sales NUMERIC NOT NULL DEFAULT 0,
      withdrawals_total NUMERIC NOT NULL DEFAULT 0,
      expected_amount NUMERIC NOT NULL,
      counted_amount NUMERIC NOT NULL,
      difference NUMERIC NOT NULL,
      count_method VARCHAR(10) NOT NULL,
      denomination_breakdown JSONB,
      discrepancy_reason VARCHAR(50),
      discrepancy_note TEXT,
      closed_by_pin VARCHAR(4) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_cash_closings_store_date ON cash_closings(store_id, business_date)`;
  console.log("Migration complete.");
  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
