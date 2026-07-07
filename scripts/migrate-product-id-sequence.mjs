/**
 * Backlog fix: product IDs (PRODxxx) were computed in app code via
 * `SELECT ... ORDER BY id DESC LIMIT 1 FOR UPDATE` then max+1 — this still
 * races under concurrent inserts (the FOR UPDATE lock only guards the existing
 * last row, not the as-yet-nonexistent next id, so two transactions can compute
 * the same next id and collide). A real sequence makes id generation atomic.
 *
 * Usage: node scripts/migrate-product-id-sequence.mjs
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
  await sql`CREATE SEQUENCE IF NOT EXISTS products_id_seq`;

  const [{ maxNum }] = await sql`
    SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 5) AS INTEGER)), 0) AS "maxNum"
    FROM products WHERE id ~ '^PROD[0-9]+$'
  `;
  await sql`SELECT setval('products_id_seq', ${maxNum})`;

  console.log(`products_id_seq created, set to ${maxNum} (next call returns ${Number(maxNum) + 1}).`);
  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
