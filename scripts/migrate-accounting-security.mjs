/**
 * Spec-07 security/UI revision follow-up migration.
 *
 * Adds what the Phase-1 accounting ledger migration (migrate-accounting-ledger.mjs)
 * was missing once the design was revised: icon + is_system on accounts (so the
 * "จัดการบัญชี" modal can render a non-emoji icon and protect the system-created
 * default cash account the same way transaction_categories.is_system already
 * protects default categories), edit-tracking columns on transactions, and the
 * transaction_edit_history audit table backing step-up-authenticated edits
 * (spec-07 section 6.2).
 *
 * Idempotent — safe to re-run (IF NOT EXISTS everywhere, backfills only touch NULLs).
 *
 * Usage: node scripts/migrate-accounting-security.mjs
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

// Preset icon names (see components/icon-picker.tsx) used to backfill rows created
// before icons existed, so nothing renders blank in the UI.
const ACCOUNT_TYPE_ICON = { cash: "cash", bank: "bank", "e-wallet": "wallet", other: "dots" };
const CATEGORY_ICON_BY_NAME = {
  "ยอดขายประจำวัน": "receipt",
  "ค่าเช่า": "home",
  "ค่าน้ำค่าไฟ": "bolt",
  "เงินเดือนพนักงาน": "users",
  "ค่าวัตถุดิบ": "box",
  "อื่นๆ": "dots",
};

async function main() {
  console.log("1/6 accounts.icon + accounts.is_system...");
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS icon VARCHAR(50)`;
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE`;
  // is_system mirrors is_default_cash historically — the system only ever auto-created
  // the default cash account, so this backfill is exact, not a guess.
  await sql`UPDATE accounts SET is_system = TRUE WHERE is_default_cash = TRUE AND is_system = FALSE`;

  console.log("2/6 backfilling account icons by account_type...");
  for (const [type, icon] of Object.entries(ACCOUNT_TYPE_ICON)) {
    await sql`UPDATE accounts SET icon = ${icon} WHERE account_type = ${type} AND icon IS NULL`;
  }

  console.log("3/6 transaction_categories.icon NOT NULL + backfill...");
  for (const [name, icon] of Object.entries(CATEGORY_ICON_BY_NAME)) {
    await sql`UPDATE transaction_categories SET icon = ${icon} WHERE name = ${name} AND icon IS NULL`;
  }
  // Any custom category a store already created before icons existed — fall back to a
  // neutral tag icon rather than leaving it NULL (can't guess what they meant).
  await sql`UPDATE transaction_categories SET icon = 'tag' WHERE icon IS NULL`;
  await sql`ALTER TABLE transaction_categories ALTER COLUMN icon SET NOT NULL`;

  console.log("4/6 transactions.last_edited_by / last_edited_at...");
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS last_edited_by INTEGER REFERENCES users(id)`;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ`;

  console.log("5/6 creating transaction_edit_history table...");
  await sql`
    CREATE TABLE IF NOT EXISTS transaction_edit_history (
      id SERIAL PRIMARY KEY,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id),
      edited_by INTEGER NOT NULL REFERENCES users(id),
      old_values JSONB NOT NULL,
      new_values JSONB NOT NULL,
      edited_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_tx_edit_history_tx ON transaction_edit_history(transaction_id)`;

  console.log("6/6 sanity check — any accounts/categories still missing an icon?");
  const [{ count: missingAccounts }] = await sql`SELECT count(*)::int FROM accounts WHERE icon IS NULL`;
  const [{ count: missingCategories }] = await sql`SELECT count(*)::int FROM transaction_categories WHERE icon IS NULL`;
  if (missingAccounts > 0 || missingCategories > 0) {
    console.warn(`   ⚠ ${missingAccounts} accounts and ${missingCategories} categories still have no icon`);
  } else {
    console.log("   all good.");
  }

  console.log("Migration complete.");
  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
