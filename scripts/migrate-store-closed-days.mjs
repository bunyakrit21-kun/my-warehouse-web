/**
 * store_closed_days: วันที่เจ้าของทำเครื่องหมาย "ร้านปิด/วันหยุด" — ไม่นับเป็นวันค้างปิดยอด
 * (Applied to production Supabase on 2026-07-16 via MCP; kept for other environments.)
 * Usage: node scripts/migrate-store-closed-days.mjs
 */
import fs from "fs";
import postgres from "postgres";
const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const match = env.match(/^DATABASE_URL=(.*)$/m);
let dbUrl = match[1].trim();
if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) dbUrl = dbUrl.slice(1, -1);
const sql = postgres(dbUrl, { ssl: "require", max: 1 });
async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS store_closed_days (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      business_date DATE NOT NULL, reason TEXT,
      marked_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (store_id, business_date)
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_store_closed_days_store ON store_closed_days(store_id, business_date)`;
  await sql`ALTER TABLE store_closed_days ENABLE ROW LEVEL SECURITY`;
  console.log("Migration complete.");
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
