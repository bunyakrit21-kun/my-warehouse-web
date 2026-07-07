/**
 * Spec-06: adds stores.default_language, captured at signup (auto-suggested from
 * country, editable). Existing stores default to 'th' to match current behavior.
 *
 * Usage: node scripts/migrate-store-language.mjs
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
  await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS default_language VARCHAR(5) DEFAULT 'th'`;
  console.log("Migration complete.");
  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
