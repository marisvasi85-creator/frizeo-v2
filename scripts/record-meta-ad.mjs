import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoDir = path.join(__dirname, "..", "public", "demo", "meta-ad");
const outDir = path.join(demoDir, "raw");
fs.mkdirSync(outDir, { recursive: true });

const htmlPath = path.join(demoDir, "index.html");
const fileUrl = `file://${htmlPath}`;

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-dev-shm-usage"],
});

const context = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: outDir,
    size: { width: 1080, height: 1920 },
  },
});

const page = await context.newPage();
await page.goto(fileUrl, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__FRIZEO_AD_READY__ === true);

await page.waitForTimeout(400);
await page.evaluate(() => window.__FRIZEO_AD_RUN__());
await page.waitForFunction(() => document.body.dataset.done === "1", null, {
  timeout: 45000,
});
await page.waitForTimeout(500);

await context.close();
await browser.close();

const videos = fs.readdirSync(outDir).filter((f) => f.endsWith(".webm"));
if (!videos.length) {
  console.error("No video recorded");
  process.exit(1);
}

console.log(path.join(outDir, videos[0]));
