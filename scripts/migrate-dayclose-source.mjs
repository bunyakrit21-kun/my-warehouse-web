/**
 * ปลดล็อก transactions_source_check ให้รองรับ 'cash_closing_dayclose' (รายการโอนเก็บเงิน
 * ออกจากเก๊ะตอนปิดร้าน) และเพิ่ม cash_closings.kept_in_drawer (เงินที่นับแยกเหลือไว้ใน
 * เก๊ะจริงตอนปิดร้าน — วันใหม่เปิดด้วยยอดนี้)
 * (Applied to production Supabase on 2026-07-09 via MCP; kept for other environments.)
 *
 * Usage: node scripts/migrate-dayclose-source.mjs
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
    CHECK (source::text = ANY (ARRAY['manual', 'cash_closing', 'cash_closing_dayclose']))`;
  await sql`ALTER TABLE cash_closings ADD COLUMN IF NOT EXISTS kept_in_drawer NUMERIC`;
  console.log("Migration complete.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
