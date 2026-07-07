/**
 * Retrofits daily_stock_checks (fresh-produce daily check) onto business_date,
 * per spec-01's requirement that it apply retroactively. check_date was already
 * a plain grouping key computed via hardcoded Asia/Bangkok calendar day, so this
 * is a straight rename — the unique constraint and existing values carry over
 * unchanged (every store today uses the default 00:00 cutoff + TH timezone,
 * so calendar day === business_date for all existing rows).
 *
 * Usage: node scripts/migrate-fresh-check-business-date.mjs
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
  await sql`ALTER TABLE daily_stock_checks RENAME COLUMN check_date TO business_date`;
  console.log("Migration complete.");
  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
