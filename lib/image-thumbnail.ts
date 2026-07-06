import sharp from "sharp";

const THUMB_WIDTH = 160;
const THUMB_QUALITY = 55;

// Product photos are stored as full-size base64 data URIs (often 50-300KB each).
// List endpoints must not return these directly — return this thumbnail instead
// (~3-8KB) so pages that render N products don't ship N * 100KB of JSON.
export async function createThumbnail(dataUri: string): Promise<string> {
  const commaIndex = dataUri.indexOf(",");
  const base64 = commaIndex >= 0 ? dataUri.slice(commaIndex + 1) : dataUri;
  const buffer = Buffer.from(base64, "base64");
  const resized = await sharp(buffer)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: THUMB_QUALITY })
    .toBuffer();
  return `data:image/jpeg;base64,${resized.toString("base64")}`;
}
