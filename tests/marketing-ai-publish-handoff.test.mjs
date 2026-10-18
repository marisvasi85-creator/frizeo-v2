import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  bookingLinkForRealPublish,
  publishCaption,
  publishImageCopy,
} from "../lib/marketing-ai/publishCardCopy.ts";
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

test("publish image stays short and does not carry a staging booking link", () => {
  const long = "Aceasta este descrierea lungă a salonului, cu detalii despre program, servicii și modul în care clientul alege ora fără să sune.";
  const copy = publishImageCopy({
    title: "Tu te ocupi de tuns iar Frizeo ține programările la zi",
    content: `Programare în câteva secunde. Reminder automat.\nTu alegi ora.\n${long}`,
    callToAction: "Programează-te: https://staging.frizeo.ro/booking/barber-1",
    bookingUrl: "https://staging.frizeo.ro/booking/barber-1",
  });
  assert.ok(copy.title.length <= 48);
  assert.equal(copy.title.includes("programările"), false);
  assert.equal(copy.content.includes(long), false);
  assert.deepEqual(copy.content.split(" · "), [
    "Programare în câteva secunde",
    "Reminder automat",
    "Tu alegi ora",
  ]);
  assert.equal(copy.callToAction.includes("staging.frizeo.ro"), false);
  assert.equal(copy.bookingUrl, undefined);
  assert.equal(bookingLinkForRealPublish("https://staging.frizeo.ro/booking/barber-1"), null);
  assert.equal(
    bookingLinkForRealPublish("https://www.frizeo.ro/booking/salon/demo-barber-salon/andrei"),
    "https://www.frizeo.ro/booking/salon/demo-barber-salon/andrei",
  );
  assert.equal(bookingLinkForRealPublish("https://www.frizeo.ro/"), null);

  const caption = publishCaption({
    content: `${long} https://staging.frizeo.ro/booking/barber-1`,
    callToAction: "Alege ora.",
    hashtags: ["frizerie"],
    bookingUrl: "https://staging.frizeo.ro/booking/barber-1",
  });
  assert.equal(caption.includes(long), true);
  assert.equal(caption.includes("staging.frizeo.ro"), false);
  assert.equal(caption.includes("#frizerie"), true);
});

test("publish page receives the handoff and does not publish it", () => {
  const client = readFileSync(join(root, "app/admin/marketing-ai/MarketingAIClient.tsx"), "utf8");
  const composer = readFileSync(join(root, "app/admin/marketing/publish/PublishComposer.tsx"), "utf8");
  const page = readFileSync(join(root, "app/admin/marketing/publish/page.tsx"), "utf8");
  assert.match(client, /Pregătește pentru publicare/);
  assert.match(client, /format: "square"/);
  assert.match(client, /publishImageCopy/);
  assert.match(client, /publishCaption/);
  assert.match(client, /content: draft\.content/);
  assert.match(client, /content: copy\.content/);
  assert.doesNotMatch(readFileSync(join(root, "lib/marketing-ai/publishCardCopy.ts"), "utf8"), /staging\.frizeo\.ro[\s\S]{0,40}www\.frizeo\.ro|www\.frizeo\.ro[\s\S]{0,40}staging\.frizeo\.ro/);
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
