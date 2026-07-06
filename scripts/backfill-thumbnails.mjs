/**
 * Backfill scripts/products.image_thumbnail from the existing full-size
 * products.image column, so list endpoints can return a small thumbnail
 * instead of the full (often 50-300KB) base64 photo.
 *
 * Usage: node scripts/backfill-thumbnails.mjs
 */

import fs from "fs";
import postgres from "postgres";
import sharp from "sharp";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const match = env.match(/^DATABASE_URL=(.*)$/m);
let dbUrl = match[1].trim();
if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
  dbUrl = dbUrl.slice(1, -1);
}

const sql = postgres(dbUrl, { ssl: "require", max: 1 });

const THUMB_WIDTH = 160;
const THUMB_QUALITY = 55;

async function makeThumbnail(dataUri) {
  const commaIndex = dataUri.indexOf(",");
  const base64 = commaIndex >= 0 ? dataUri.slice(commaIndex + 1) : dataUri;
  const buffer = Buffer.from(base64, "base64");
  const resized = await sharp(buffer)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: THUMB_QUALITY })
    .toBuffer();
  return `data:image/jpeg;base64,${resized.toString("base64")}`;
}

async function main() {
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_thumbnail TEXT`;
  console.log("✓ image_thumbnail column ready");

  const rows = await sql`
    SELECT id, image FROM products
    WHERE image IS NOT NULL AND image != '' AND image_thumbnail IS NULL
  `;
  console.log(`Found ${rows.length} products needing a thumbnail`);

  let done = 0;
  let failed = 0;
  let totalBefore = 0;
  let totalAfter = 0;

  for (const row of rows) {
    try {
      const thumbnail = await makeThumbnail(row.image);
      await sql`UPDATE products SET image_thumbnail = ${thumbnail} WHERE id = ${row.id}`;
      totalBefore += row.image.length;
      totalAfter += thumbnail.length;
      done++;
    } catch (err) {
      failed++;
      console.error(`✗ ${row.id}: ${err.message}`);
    }
  }

  console.log(`\nDone: ${done} succeeded, ${failed} failed`);
  if (done > 0) {
    console.log(
      `Payload size for these ${done} images: ${(totalBefore / 1024 / 1024).toFixed(2)}MB → ${(totalAfter / 1024 / 1024).toFixed(2)}MB`,
    );
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
