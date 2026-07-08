/**
 * Audit table for the 7-day retroactive-correction feature: every edit/delete of
 * a movement, cash withdrawal, or ledger transaction gets logged here with the
 * editor and before/after values. (Already applied to the production Supabase DB
 * on 2026-07-09 via MCP — kept here so other environments can replay it.)
 *
 * Usage: node scripts/migrate-record-edits.mjs
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
  await sql`
    CREATE TABLE IF NOT EXISTS record_edits (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL,
      record_type TEXT NOT NULL CHECK (record_type IN ('movement', 'cash_withdrawal', 'transaction', 'cash_closing')),
      record_id INTEGER NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('edit', 'delete')),
      edited_by INTEGER NOT NULL,
      old_values JSONB,
      new_values JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_record_edits_store ON record_edits(store_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_record_edits_record ON record_edits(record_type, record_id)`;
  await sql`ALTER TABLE record_edits ENABLE ROW LEVEL SECURITY`;
  console.log("Migration complete.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
