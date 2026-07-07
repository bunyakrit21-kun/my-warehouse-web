/**
 * Spec-06 Phase 1: adds rate-limit/lockout tracking columns.
 * PIN brute-forcing targets a store (guessing across ~10,000 4-digit combos,
 * not any specific user), so PIN lockout is tracked per-store. Password
 * brute-forcing targets one specific account, so it's tracked per-user.
 *
 * Usage: node scripts/migrate-login-lockout.mjs
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
  await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS pin_failed_attempts INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_password_attempts INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_locked_until TIMESTAMPTZ`;
  console.log("Migration complete.");
  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
