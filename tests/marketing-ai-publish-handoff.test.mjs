import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  base64ToBytes,
  takeMarketingPublishHandoff,
  writeMarketingPublishHandoff,
} from "../lib/marketing-ai/publishHandoff.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("marketing handoff keeps the caption and image for one read", () => {
  const storage = memoryStorage();
  const bytes = Uint8Array.from([1, 2, 3, 255, 10]);
  const saved = writeMarketingPublishHandoff(storage, {
    caption: "Text din Marketing AI",
    bytes,
    mimeType: "image/jpeg",
  });
  assert.equal(saved, true);
  const handoff = takeMarketingPublishHandoff(storage);
  assert.equal(handoff?.caption, "Text din Marketing AI");
  assert.equal(handoff?.mimeType, "image/jpeg");
  assert.equal(handoff?.fileName, "marketing-ai.jpg");
  assert.deepEqual(base64ToBytes(handoff.imageBase64), bytes);
  assert.equal(takeMarketingPublishHandoff(storage), null);
});

test("marketing handoff rejects an empty or oversized image and a caption that cannot be edited into the form", () => {
  const storage = memoryStorage();
  assert.equal(writeMarketingPublishHandoff(storage, {
    caption: "ok",
    bytes: new Uint8Array(),
    mimeType: "image/png",
  }), false);
  assert.equal(writeMarketingPublishHandoff(storage, {
    caption: "a".repeat(2201),
    bytes: Uint8Array.from([1]),
    mimeType: "image/png",
  }), false);
  assert.equal(writeMarketingPublishHandoff(storage, {
    caption: "ok",
    bytes: new Uint8Array(1_500_001),
    mimeType: "image/jpeg",
  }), false);
  assert.equal(takeMarketingPublishHandoff(storage), null);
});

test("publish page receives the handoff and does not publish it", () => {
  const client = readFileSync(join(root, "app/admin/marketing-ai/MarketingAIClient.tsx"), "utf8");
  const composer = readFileSync(join(root, "app/admin/marketing/publish/PublishComposer.tsx"), "utf8");
  const page = readFileSync(join(root, "app/admin/marketing/publish/page.tsx"), "utf8");
  assert.match(client, /Pregătește pentru publicare/);
  assert.match(client, /format: "square"/);
  assert.match(client, /buildShareCaption/);
  assert.match(client, /saveMarketingPublishHandoff/);
  assert.match(client, /router\.push\("\/admin\/marketing\/publish"\)/);
  assert.match(client, /canPreparePublish = role === "owner" \|\| role === "manager"/);
  assert.doesNotMatch(client, /\/api\/integrations\/meta\/publish\/live/);
  assert.doesNotMatch(client, /media_publish/);
  assert.match(composer, /readMarketingPublishHandoff/);
  assert.match(composer, /instagram_business/);
  assert.match(composer, /confirmă publicarea manual/);
  assert.match(composer, /readMarketingPublishHandoff\(\)[\s\S]{0,80}if \(!handoff\) return;/);
  const handoffAt = composer.indexOf("readMarketingPublishHandoff");
  const toggleAt = composer.indexOf("function toggle", handoffAt);
  assert.ok(handoffAt > 0 && toggleAt > handoffAt);
  assert.doesNotMatch(composer.slice(handoffAt, toggleAt), /fetch\(|media_publish/);
  assert.match(page, /isProduction\(\)/);
  assert.doesNotMatch(client, /tenant_capabilities/);
  assert.doesNotMatch(readFileSync(join(root, "lib/marketing-ai/publishHandoff.ts"), "utf8"), /media_publish|graph\.facebook\.com/);
});
