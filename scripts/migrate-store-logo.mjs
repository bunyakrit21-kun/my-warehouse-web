/**
 * Adds stores.logo / stores.logo_thumbnail (same base64-data-URI pattern as
 * products.image / products.image_thumbnail — this codebase stores photos
 * inline rather than in object storage).
 *
 * Usage: node scripts/migrate-store-logo.mjs
 */

import fs from "fs";
import postgres from "postgres";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const match = env.match(/^DATABASE_URL=(.*)$/m);
let dbUrl = match[1].trim();
if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
  dbUrl = dbUrl.slice(1, -1);
}

const sql = postgres(dbUrl, { ssl: "require", max: 1, prepare: false });

async function main() {
  await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS logo TEXT`;
  await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS logo_thumbnail TEXT`;
  console.log("Migration complete.");
  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
