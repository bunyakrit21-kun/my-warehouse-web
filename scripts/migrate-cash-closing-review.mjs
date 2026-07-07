/**
 * Spec-04 Phase 2/3: adds review/audit columns to cash_closings.
 * - schedule_mismatch: true when the confirming PIN's user wasn't among the
 *   staff scheduled for that shift/business_date (only set when schedule_entries
 *   actually has assignments for that shift/date — stores with no schedule at
 *   all are never flagged).
 * - acknowledged_by_user_id / acknowledged_at: manager sign-off on a flagged closing.
 * - edit_history: JSONB array of {editedByUserId, editedAt, changes} snapshots,
 *   appended each time an already-closed record is corrected.
 *
 * Usage: node scripts/migrate-cash-closing-review.mjs
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
  await sql`ALTER TABLE cash_closings ADD COLUMN IF NOT EXISTS schedule_mismatch BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE cash_closings ADD COLUMN IF NOT EXISTS acknowledged_by_user_id INTEGER REFERENCES users(id)`;
  await sql`ALTER TABLE cash_closings ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ`;
  await sql`ALTER TABLE cash_closings ADD COLUMN IF NOT EXISTS edit_history JSONB`;
  console.log("Migration complete.");
  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
