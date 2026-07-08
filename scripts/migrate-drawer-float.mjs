/**
 * เงินในเก๊ะ + ปิดยอดรายวัน: stores.drawer_float (เงินทอนที่ค้างในลิ้นชักตลอด) และ
 * cash_closings.is_day_close (ปิดยอดสุดท้ายของวัน — เก็บเงินส่วนเกินออก วันใหม่เริ่มจาก drawer_float)
 * (Applied to production Supabase on 2026-07-09 via MCP; kept for other environments.)
 *
 * Usage: node scripts/migrate-drawer-float.mjs
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
  await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS drawer_float NUMERIC NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE cash_closings ADD COLUMN IF NOT EXISTS is_day_close BOOLEAN NOT NULL DEFAULT false`;
  console.log("Migration complete.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
