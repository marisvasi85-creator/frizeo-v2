#!/usr/bin/env node
/**
 * Generates Frizeo brand logos matching lib/site/brandMark.tsx (F on #0B0B0C).
 * Output: public/brand/frizeo-logo-{120,512}.png
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "brand");
mkdirSync(outDir, { recursive: true });

function logoSvg(size) {
  const fontSize = Math.round(size * 0.625);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0B0B0C"/>
  <text
    x="50%"
    y="54%"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    font-size="${fontSize}"
    font-weight="600"
    fill="#FFFFFF"
    text-anchor="middle"
    dominant-baseline="middle"
    letter-spacing="-0.04em"
  >F</text>
</svg>`;
}

for (const size of [120, 512]) {
  const path = join(outDir, `frizeo-logo-${size}.png`);
  await sharp(Buffer.from(logoSvg(size))).png().toFile(path);
  console.log(`Created ${path}`);
}

console.log("\nDownload URLs after deploy:");
console.log("  https://www.frizeo.ro/brand/frizeo-logo-512.png");
console.log("  https://www.frizeo.ro/brand/frizeo-logo-120.png");
