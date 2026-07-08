/**
 * Adds indexes for the reports page: /api/reports filters movements and
 * cash_withdrawals by store_id + created_at (NOW() - interval), but the only
 * existing indexes cover business_date. Without these, stores with a lot of
 * history sequential-scan on every reports load.
 *
 * Usage: node scripts/migrate-movements-created-at-index.mjs
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
  await sql`CREATE INDEX IF NOT EXISTS idx_movements_store_created ON movements(store_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cash_withdrawals_store_created ON cash_withdrawals(store_id, created_at)`;
  console.log("Migration complete.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
