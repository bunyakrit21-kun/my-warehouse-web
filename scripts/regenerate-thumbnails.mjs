/**
 * Regenerates products.image_thumbnail for ALL products from the full-size
 * image column, using the current THUMB_WIDTH/THUMB_QUALITY in
 * lib/image-thumbnail.ts. Use this after tuning thumbnail settings.
 *
 * Usage: node scripts/regenerate-thumbnails.mjs
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

const THUMB_WIDTH = 100;
const THUMB_QUALITY = 45;

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
  const rows = await sql`
    SELECT id, image FROM products WHERE image IS NOT NULL AND image != ''
  `;
  console.log(`Regenerating thumbnails for ${rows.length} products`);

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
      `Full image size: ${(totalBefore / 1024 / 1024).toFixed(2)}MB → thumbnail size: ${(totalAfter / 1024).toFixed(1)}KB`,
    );
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
