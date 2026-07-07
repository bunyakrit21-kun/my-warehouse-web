/**
 * Adds stores.country (drives which IANA timezone getBusinessDate() uses).
 * Existing stores default to 'TH' (Asia/Bangkok), matching current behavior.
 *
 * Usage: node scripts/migrate-store-country.mjs
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
  await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS country VARCHAR(2) DEFAULT 'TH'`;
  console.log("Migration complete.");
  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
