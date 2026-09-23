import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const canvases = [];
const drawCalls = [];
let imageSize = { width: 1600, height: 900 };

function installCanvas() {
  canvases.length = 0;
  drawCalls.length = 0;

  class FakeCanvas {
    constructor() {
      this.width = 0;
      this.height = 0;
      canvases.push(this);
    }

    getContext() {
      return {
        fillStyle: "",
        font: "",
        textAlign: "",
        textBaseline: "",
        fillRect() {},
        fillText() {},
        beginPath() {},
        moveTo() {},
        arcTo() {},
        closePath() {},
        fill() {},
        save() {},
        restore() {},
        clip() {},
        measureText() {
          return { width: 20 };
        },
        drawImage(...args) {
          drawCalls.push(args);
        },
        createLinearGradient() {
          return { addColorStop() {} };
        },
        createRadialGradient() {
          return { addColorStop() {} };
        },
      };
    }

    toBlob(callback) {
      callback(new Blob([Uint8Array.from([137, 80, 78, 71])], { type: "image/png" }));
    }
  }

  globalThis.document = {
    createElement(tag) {
      if (tag !== "canvas") throw new Error(`unexpected element ${tag}`);
      return new FakeCanvas();
    },
  };

  globalThis.Image = class FakeImage {
    constructor() {
      this.width = imageSize.width;
      this.height = imageSize.height;
      this.onload = null;
      this.onerror = null;
    }

    set src(_value) {
      queueMicrotask(() => this.onload?.());
    }
  };
}

installCanvas();

const {
  coverCropRect,
  photoBandHeight,
  preferredBrandedCardFormat,
  renderBrandedCardToBlob,
} = await import("../lib/marketing-ai/brandedCard.ts");

const card = {
  salonName: "Studio",
  barberName: "Wassell",
  logoUrl: null,
  bookingUrl: "https://frizeo.ro/booking/studio",
  title: "Lucrare nouă",
  content: "Rezultat proaspăt, gata de programare.",
  callToAction: "Programează-te online",
};

function lastCanvas() {
  return canvases[canvases.length - 1];
}

function photoDraw() {
  return drawCalls.find((args) => args.length === 9);
}

test("feed exports stay 1080x1080 and story, reel and tiktok stay 1080x1920", () => {
  assert.equal(preferredBrandedCardFormat("instagram_post", "instagram"), "square");
  assert.equal(preferredBrandedCardFormat("service_promo", "facebook"), "square");
  assert.equal(preferredBrandedCardFormat("christmas_promo", "instagram"), "square");
  assert.equal(preferredBrandedCardFormat("easter_promo", "whatsapp"), "square");
  assert.equal(preferredBrandedCardFormat("open_slots", "instagram"), "square");
  assert.equal(preferredBrandedCardFormat("work_promo", "instagram"), "square");
  assert.equal(preferredBrandedCardFormat("story", "story"), "story");
  assert.equal(preferredBrandedCardFormat("reel", "reel"), "story");
  assert.equal(preferredBrandedCardFormat("instagram_post", "tiktok"), "story");
  assert.equal(preferredBrandedCardFormat("service_promo", "tiktok"), "story");
  assert.equal(preferredBrandedCardFormat("work_promo", "tiktok"), "story");
  assert.equal(preferredBrandedCardFormat("work_promo", "reel"), "story");
  assert.equal(preferredBrandedCardFormat("open_slots", "story"), "story");
});

test("text cards set the real canvas size for post and story", async () => {
  await renderBrandedCardToBlob({ ...card, format: "square" });
  assert.deepEqual([lastCanvas().width, lastCanvas().height], [1080, 1080]);

  await renderBrandedCardToBlob({ ...card, format: "story" });
  assert.deepEqual([lastCanvas().width, lastCanvas().height], [1080, 1920]);
});

test("work photos render two real canvases and cover-crop without stretching", async () => {
  imageSize = { width: 1600, height: 900 };
  drawCalls.length = 0;
  await renderBrandedCardToBlob({
    ...card,
    format: "square",
    photoUrl: "blob:work-wide",
  });
  const square = lastCanvas();
  const squareDraw = photoDraw();
  assert.deepEqual([square.width, square.height], [1080, 1080]);
  assert.equal(squareDraw[7], 1080);
  assert.equal(squareDraw[8], photoBandHeight("square"));
  assert.ok(squareDraw[8] > square.height * 0.6);
  assertCover(squareDraw, 1600, 900, 1080, photoBandHeight("square"));

  imageSize = { width: 800, height: 1800 };
  drawCalls.length = 0;
  await renderBrandedCardToBlob({
    ...card,
    format: "story",
    photoUrl: "blob:work-tall",
  });
  const story = lastCanvas();
  const storyDraw = photoDraw();
  assert.deepEqual([story.width, story.height], [1080, 1920]);
  assert.notEqual(story.height, square.height);
  assert.equal(storyDraw[7], 1080);
  assert.equal(storyDraw[8], photoBandHeight("story"));
  assert.ok(storyDraw[8] > story.height * 0.6);
  assertCover(storyDraw, 800, 1800, 1080, photoBandHeight("story"));
});

function assertCover(draw, srcW, srcH, destW, destH) {
  const [, sx, sy, sw, sh, dx, dy, dw, dh] = draw;
  const expected = coverCropRect(srcW, srcH, destW, destH);
  assert.ok(Math.abs(sx - expected.sx) < 0.001);
  assert.ok(Math.abs(sy - expected.sy) < 0.001);
  assert.ok(Math.abs(sw - expected.sw) < 0.001);
  assert.ok(Math.abs(sh - expected.sh) < 0.001);
  assert.equal(dx, 0);
  assert.equal(dy, 0);
  assert.equal(dw, destW);
  assert.equal(dh, destH);
  assert.ok(Math.abs(sw / sh - destW / destH) < 0.001);
  assert.ok(sw <= srcW + 0.001 && sh <= srcH + 0.001);
  assert.ok(Math.abs(dw / sw - dh / sh) < 0.001);
}

test("export labels name the real sizes and do not promise a reel video", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const button = readFileSync(join(root, "../app/admin/marketing-ai/BrandedCardButton.tsx"), "utf8");
  assert.match(button, /Descarcă Post \(\{squareMeta\.label\}\)/);
  assert.match(button, /Descarcă Story\/Reel \(\{storyMeta\.label\}\)/);
  assert.match(button, /nu un video/);
  assert.doesNotMatch(button, /Descarcă Story \(\{/);
  assert.equal(button.includes("generează un video"), false);
  assert.equal(button.includes("video Reel"), false);
});
