/**
 * Generate PWA PNG icons from icon.svg
 * Run: npx tsx scripts/generate-pwa-icons.ts
 */

import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";

const ICONS_DIR = join(process.cwd(), "public", "icons");
const SVG_PATH = join(ICONS_DIR, "icon.svg");

async function main() {
  const svg = readFileSync(SVG_PATH);

  await sharp(svg)
    .resize(192, 192)
    .png()
    .toFile(join(ICONS_DIR, "icon-192.png"));
  console.log("✓ icon-192.png");

  await sharp(svg)
    .resize(512, 512)
    .png()
    .toFile(join(ICONS_DIR, "icon-512.png"));
  console.log("✓ icon-512.png");

  await sharp(svg)
    .resize(180, 180)
    .png()
    .toFile(join(ICONS_DIR, "apple-touch-icon.png"));
  console.log("✓ apple-touch-icon.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
