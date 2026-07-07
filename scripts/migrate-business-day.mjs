/**
 * One-off migration for spec-01 (Business Day Foundation):
 * - adds business_day_start_time / business_day_end_time to stores
 * - adds business_date to movements / cash_withdrawals + backfills existing rows
 * - adds supporting indexes
 *
 * Usage: node scripts/migrate-business-day.mjs
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
  await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS business_day_start_time TIME DEFAULT '00:00'`;
  await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS business_day_end_time TIME DEFAULT '00:00'`;

  await sql`ALTER TABLE movements ADD COLUMN IF NOT EXISTS business_date DATE`;
  await sql`ALTER TABLE cash_withdrawals ADD COLUMN IF NOT EXISTS business_date DATE`;

  await sql`CREATE INDEX IF NOT EXISTS idx_movements_business_date ON movements(store_id, business_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cash_withdrawals_business_date ON cash_withdrawals(store_id, business_date)`;

  // Backfill: every store currently uses the default 00:00 cutoff, so business_date
  // for existing rows is just the calendar date in Asia/Bangkok wall-clock time.
  const movResult = await sql`
    UPDATE movements
    SET business_date = ((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date
    WHERE business_date IS NULL
  `;
  const cwResult = await sql`
    UPDATE cash_withdrawals
    SET business_date = (created_at AT TIME ZONE 'Asia/Bangkok')::date
    WHERE business_date IS NULL
  `;

  console.log(`Backfilled ${movResult.count} movements, ${cwResult.count} cash_withdrawals rows`);
  console.log("Migration complete.");
  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
