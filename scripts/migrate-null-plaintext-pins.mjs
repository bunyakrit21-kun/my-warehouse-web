/**
 * ลบ PIN แบบ plaintext ที่ค้างในตารางประวัติ (movements/cash_withdrawals.employee_pin)
 * ชื่อพนักงาน resolve ผ่าน user_id JOIN users อยู่แล้ว คอลัมน์นี้ไม่จำเป็นและเป็นความเสี่ยง
 * (Applied to production Supabase on 2026-07-09 via MCP; kept for other environments.)
 *
 * Usage: node scripts/migrate-null-plaintext-pins.mjs
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
  await sql`UPDATE movements SET employee_pin = NULL WHERE employee_pin IS NOT NULL`;
  await sql`UPDATE cash_withdrawals SET employee_pin = NULL WHERE employee_pin IS NOT NULL`;
  console.log("Cleared plaintext PINs.");
  await sql.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
