/**
 * Spec-06 Phase 1: hashes users.pin with bcrypt (was plain text) and adds
 * user_id reference columns so movements/cash_withdrawals/cash_closings/
 * daily_stock_checks can resolve "who did this" without matching on plain PIN.
 *
 * Safe to re-run: backfill only touches rows with a NULL user_id/closed_by_user_id/
 * checked_by_user_id, and pin hashing skips values that already look like a bcrypt
 * hash (start with "$2").
 *
 * Usage: node scripts/migrate-hash-pins.mjs
 */

import fs from "fs";
import postgres from "postgres";
import bcrypt from "bcryptjs";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const match = env.match(/^DATABASE_URL=(.*)$/m);
let dbUrl = match[1].trim();
if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
  dbUrl = dbUrl.slice(1, -1);
}

const sql = postgres(dbUrl, { ssl: "require", max: 1 });

async function main() {
  console.log("1/4 Adding user_id reference columns...");
  await sql`ALTER TABLE movements ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)`;
  await sql`ALTER TABLE cash_withdrawals ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)`;
  await sql`ALTER TABLE cash_closings ADD COLUMN IF NOT EXISTS closed_by_user_id INTEGER REFERENCES users(id)`;
  await sql`ALTER TABLE daily_stock_checks ADD COLUMN IF NOT EXISTS checked_by_user_id INTEGER REFERENCES users(id)`;

  console.log("2/4 Relaxing NOT NULL on legacy plain-pin columns (going forward these stay NULL)...");
  await sql`ALTER TABLE cash_withdrawals ALTER COLUMN employee_pin DROP NOT NULL`;
  await sql`ALTER TABLE cash_closings ALTER COLUMN closed_by_pin DROP NOT NULL`;
  await sql`ALTER TABLE daily_stock_checks ALTER COLUMN checked_by_pin DROP NOT NULL`;

  console.log("3/4 Backfilling user_id from existing plain-text PIN matches...");
  const movementsResult = await sql`
    UPDATE movements m SET user_id = match.id
    FROM (
      SELECT DISTINCT ON (u.store_id, u.pin) u.id, u.store_id, u.pin
      FROM users u WHERE u.pin IS NOT NULL
      ORDER BY u.store_id, u.pin, u.active DESC
    ) match
    WHERE m.user_id IS NULL AND m.employee_pin IS NOT NULL
      AND m.store_id = match.store_id AND m.employee_pin = match.pin
  `;
  console.log(`   movements: ${movementsResult.count} rows backfilled`);

  const cashWithdrawalsResult = await sql`
    UPDATE cash_withdrawals cw SET user_id = match.id
    FROM (
      SELECT DISTINCT ON (u.store_id, u.pin) u.id, u.store_id, u.pin
      FROM users u WHERE u.pin IS NOT NULL
      ORDER BY u.store_id, u.pin, u.active DESC
    ) match
    WHERE cw.user_id IS NULL AND cw.employee_pin IS NOT NULL
      AND cw.store_id = match.store_id AND cw.employee_pin = match.pin
  `;
  console.log(`   cash_withdrawals: ${cashWithdrawalsResult.count} rows backfilled`);

  const cashClosingsResult = await sql`
    UPDATE cash_closings cc SET closed_by_user_id = match.id
    FROM (
      SELECT DISTINCT ON (u.store_id, u.pin) u.id, u.store_id, u.pin
      FROM users u WHERE u.pin IS NOT NULL
      ORDER BY u.store_id, u.pin, u.active DESC
    ) match
    WHERE cc.closed_by_user_id IS NULL AND cc.closed_by_pin IS NOT NULL
      AND cc.store_id = match.store_id AND cc.closed_by_pin = match.pin
  `;
  console.log(`   cash_closings: ${cashClosingsResult.count} rows backfilled`);

  const dailyChecksResult = await sql`
    UPDATE daily_stock_checks dc SET checked_by_user_id = match.id
    FROM (
      SELECT DISTINCT ON (u.store_id, u.pin) u.id, u.store_id, u.pin
      FROM users u WHERE u.pin IS NOT NULL
      ORDER BY u.store_id, u.pin, u.active DESC
    ) match
    WHERE dc.checked_by_user_id IS NULL AND dc.checked_by_pin IS NOT NULL
      AND dc.store_id = match.store_id AND dc.checked_by_pin = match.pin
  `;
  console.log(`   daily_stock_checks: ${dailyChecksResult.count} rows backfilled`);

  console.log("4/4 Widening users.pin (was varchar(4), too short for a bcrypt hash) and hashing...");
  await sql`ALTER TABLE users ALTER COLUMN pin TYPE VARCHAR(60)`;
  const users = await sql`SELECT id, pin FROM users WHERE pin IS NOT NULL AND pin NOT LIKE '$2%'`;
  for (const u of users) {
    const hashed = await bcrypt.hash(u.pin, 10);
    await sql`UPDATE users SET pin = ${hashed} WHERE id = ${u.id}`;
  }
  console.log(`   users: ${users.length} PINs hashed`);

  console.log("Migration complete.");
  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
