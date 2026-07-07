/**
 * Spec-07 Phase 1: accounting ledger (accounts, transaction_categories, transactions).
 * Uses integer SERIAL PKs to match this codebase's existing tables (stores/movements/
 * cash_closings/etc. all use serial ids, not UUID as spec-07.md's draft schema shows).
 *
 * Backfills a default "เงินสด" account + system categories for stores that existed
 * before this migration, so cash-closing auto-linking has somewhere to post to.
 *
 * Usage: node scripts/migrate-accounting-ledger.mjs
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

const DEFAULT_EXPENSE_CATEGORIES = ["ค่าเช่า", "ค่าน้ำค่าไฟ", "เงินเดือนพนักงาน", "ค่าวัตถุดิบ", "อื่นๆ"];

async function main() {
  console.log("1/4 Creating accounts table...");
  await sql`
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL REFERENCES stores(id),
      name VARCHAR(100) NOT NULL,
      account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('cash', 'bank', 'e-wallet', 'other')),
      current_balance NUMERIC NOT NULL DEFAULT 0,
      is_default_cash BOOLEAN NOT NULL DEFAULT FALSE,
      archived_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_accounts_store ON accounts(store_id)`;

  console.log("2/4 Creating transaction_categories table...");
  await sql`
    CREATE TABLE IF NOT EXISTS transaction_categories (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL REFERENCES stores(id),
      name VARCHAR(100) NOT NULL,
      type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
      icon VARCHAR(50),
      is_system BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_categories_store ON transaction_categories(store_id)`;

  console.log("3/4 Creating transactions table...");
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL REFERENCES stores(id),
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      transfer_to_account_id INTEGER REFERENCES accounts(id),
      category_id INTEGER REFERENCES transaction_categories(id),
      type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
      amount NUMERIC NOT NULL,
      note TEXT,
      business_date DATE NOT NULL,
      source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'cash_closing')),
      source_ref_id INTEGER,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_transactions_store_date ON transactions(store_id, business_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id)`;

  console.log("4/4 Backfilling default account + system categories for existing stores...");
  const stores = await sql`SELECT id FROM stores`;
  let accountsCreated = 0;
  let categoriesCreated = 0;
  for (const store of stores) {
    const [existingCash] = await sql`SELECT id FROM accounts WHERE store_id = ${store.id} AND is_default_cash = true`;
    if (!existingCash) {
      await sql`
        INSERT INTO accounts (store_id, name, account_type, is_default_cash)
        VALUES (${store.id}, 'เงินสด', 'cash', true)
      `;
      accountsCreated++;
    }

    const [existingCat] = await sql`SELECT id FROM transaction_categories WHERE store_id = ${store.id} LIMIT 1`;
    if (!existingCat) {
      await sql`
        INSERT INTO transaction_categories (store_id, name, type, is_system)
        VALUES (${store.id}, 'ยอดขายประจำวัน', 'income', true)
      `;
      for (const name of DEFAULT_EXPENSE_CATEGORIES) {
        await sql`
          INSERT INTO transaction_categories (store_id, name, type, is_system)
          VALUES (${store.id}, ${name}, 'expense', true)
        `;
      }
      categoriesCreated++;
    }
  }
  console.log(`   ${accountsCreated} default accounts created, ${categoriesCreated} stores seeded with categories`);

  console.log("Migration complete.");
  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
