/**
 * (1) เบิกเงินลงบัญชี: เพิ่ม 'cash_withdrawal' ใน transactions_source_check
 * (2) หน้าที่พนักงาน: users.duty (ประจำตัว) + schedule_entries.duty (รายเวร override ได้)
 * (Applied to production Supabase on 2026-07-09 via MCP; kept for other environments.)
 *
 * Usage: node scripts/migrate-withdrawal-ledger-duty.mjs
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
  await sql`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_source_check`;
  await sql`ALTER TABLE transactions ADD CONSTRAINT transactions_source_check
    CHECK (source::text = ANY (ARRAY['manual', 'cash_closing', 'cash_closing_dayclose', 'cash_withdrawal']))`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS duty TEXT`;
  await sql`ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS duty TEXT`;
  console.log("Migration complete.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
