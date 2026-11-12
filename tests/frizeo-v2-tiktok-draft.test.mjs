import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEMO_BARBER_TENANT_ID,
  decideTikTokDraftAccess,
  performTikTokDraftTest,
  tikTokDraftTestEnabled,
} from "../lib/integrations/tiktok/draftTest.ts";
import {
  createMediaToken,
  draftImageUrl,
  hashMediaToken,
  parseMediaToken,
  serveTikTokDraftImage,
} from "../lib/integrations/tiktok/mediaGrant.ts";
import { initTikTokPhotoInbox } from "../lib/integrations/tiktok/posting.ts";
import { normalizeTikTokPhoto, tikTokPhotoFrame } from "../lib/integrations/tiktok/photoNormalize.ts";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const demo = DEMO_BARBER_TENANT_ID;
const other = "11111111-1111-1111-1111-111111111111";
const owner = "5edac115-6694-4917-ab04-0c02cd7e2f77";
const imagePath = `${demo}/3b8f7107-59e1-4e60-8192-8c18b0e63fb9.jpg`;
const publishId = "v_pub_url~v2.123456789";
async function realJpeg(width, height) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 20, g: 80, b: 140 } },
  }).jpeg().toBuffer();
}

function allowed(overrides = {}) {
  return {
    production: false,
    stagingHost: true,
    authenticated: true,
    role: "owner",
    tenantId: demo,
    userId: owner,
    connectedBy: owner,
    configured: true,
    gateEnabled: true,
    ...overrides,
  };
}

test("the draft gate stays off and ignores the publish capability", () => {
  assert.equal(tikTokDraftTestEnabled({}), false);
  assert.equal(tikTokDraftTestEnabled({ TIKTOK_DRAFT_TEST: "false" }), false);
  assert.equal(decideTikTokDraftAccess(allowed({ gateEnabled: false })).error, "gate_off");
  assert.equal(decideTikTokDraftAccess(allowed({ production: true })).status, 404);
  assert.equal(decideTikTokDraftAccess(allowed({ tenantId: other })).error, "forbidden");
  assert.equal(decideTikTokDraftAccess(allowed({ userId: other })).error, "forbidden");
  assert.equal(decideTikTokDraftAccess(allowed({ role: "staff" })).error, "forbidden");
  const source = readFileSync(join(root, "lib/integrations/tiktok/draftTest.ts"), "utf8");
  assert.equal(source.includes("marketing.publish.tiktok"), false);
});

test("a closed gate does not claim a job or call TikTok", async () => {
  let claims = 0;
  let calls = 0;
  const result = await performTikTokDraftTest({
    access: decideTikTokDraftAccess(allowed({ gateEnabled: false })),
    caption: "Test",
    mediaObjectPath: imagePath,
    http: async () => {
      calls += 1;
      return { status: 200, body: {} };
    },
    claim: async () => {
      claims += 1;
      return { outcome: "claimed", jobId: "job-1" };
    },
    createGrant: async () => null,
    loadToken: async () => null,
    settle: async () => true,
  });
  assert.equal(result.error, "gate_off");
  assert.equal(result.externalCall, false);
  assert.equal(claims, 0);
  assert.equal(calls, 0);
});

test("the image URL is temporary, unguessable, and limited to one tenant file", async () => {
  const jpeg = await realJpeg(64, 48);
  const token = createMediaToken();
  const rawUrl = draftImageUrl(token);
  assert.equal(typeof rawUrl, "string");
  const url = new URL(rawUrl);
  assert.equal(url.origin, "https://staging.frizeo.ro");
  assert.equal(url.pathname.endsWith(".jpg"), true);
  assert.equal(url.search, "");
  assert.equal(parseMediaToken(`${token}.jpg`), token);
  assert.equal(parseMediaToken(token), null);
  const grant = {
    tenantId: demo,
    objectPath: imagePath,
    expiresAt: "2026-11-12T10:00:00.000Z",
  };
  const fresh = await serveTikTokDraftImage({
    tokenParam: `${token}.jpg`,
    production: false,
    stagingHost: true,
    now: new Date("2026-11-12T09:50:00.000Z"),
    readGrant: async (hash) => hash === hashMediaToken(token) ? grant : null,
    readObject: async (path) => path === imagePath ? jpeg : null,
  });
  assert.equal(fresh.status, 200);
  if (fresh.status === 200) {
    const served = await sharp(fresh.body).metadata();
    assert.equal(served.format, "jpeg");
    assert.equal(served.width, 64);
    assert.equal(served.height, 48);
  }
  const expired = await serveTikTokDraftImage({
    tokenParam: `${token}.jpg`,
    production: false,
    stagingHost: true,
    now: new Date("2026-11-12T10:00:00.000Z"),
    readGrant: async () => grant,
    readObject: async () => jpeg,
  });
  assert.equal(expired.status, 404);
  const crossed = await serveTikTokDraftImage({
    tokenParam: `${token}.jpg`,
    production: false,
    stagingHost: true,
    now: new Date("2026-11-12T09:50:00.000Z"),
    readGrant: async () => ({ ...grant, objectPath: `${other}/3b8f7107-59e1-4e60-8192-8c18b0e63fb9.jpg` }),
    readObject: async () => jpeg,
  });
  assert.equal(crossed.status, 404);
  const notJpeg = await serveTikTokDraftImage({
    tokenParam: `${token}.jpg`,
    production: false,
    stagingHost: true,
    now: new Date("2026-11-12T09:50:00.000Z"),
    readGrant: async () => grant,
    readObject: async () => Buffer.from("not-a-jpeg"),
  });
  assert.equal(notJpeg.status, 404);
  const production = await serveTikTokDraftImage({
    tokenParam: `${token}.jpg`,
    production: true,
    stagingHost: false,
    now: new Date("2026-11-12T09:50:00.000Z"),
    readGrant: async () => grant,
    readObject: async () => jpeg,
  });
  assert.equal(production.status, 404);
});

test("one idempotent draft calls TikTok once and a replay does not", async () => {
  let calls = 0;
  const seen = [];
  const success = await performTikTokDraftTest({
    access: { ok: true },
    caption: "Draft de test",
    mediaObjectPath: imagePath,
    http: async (request) => {
      calls += 1;
      const body = JSON.parse(request.body);
      assert.equal(request.url, "https://open.tiktokapis.com/v2/post/publish/content/init/");
      assert.equal(body.media_type, "PHOTO");
      assert.equal(body.post_mode, "MEDIA_UPLOAD");
      assert.equal(body.source_info.photo_images[0].startsWith("https://staging.frizeo.ro/"), true);
      assert.equal(body.post_mode === "DIRECT_POST", false);
      return { status: 200, body: { data: { publish_id: publishId }, error: { code: "ok" } } };
    },
    claim: async () => ({ outcome: "claimed", jobId: "job-1" }),
    createGrant: async () => ({ imageUrl: draftImageUrl(createMediaToken()) }),
    loadToken: async () => ({ accessToken: "access-value", scopes: ["user.info.basic", "video.upload"] }),
    settle: async (_job, patch) => {
      seen.push(patch);
      return true;
    },
  });
  assert.equal(success.outcome, "initiated");
  assert.equal(success.publishId, publishId);
  assert.equal(success.attempts, 1);
  assert.equal(calls, 1);
  assert.equal(seen[0].kind, "success");
  assert.equal("imageUrl" in success, false);

  let replayCalls = 0;
  const replay = await performTikTokDraftTest({
    access: { ok: true },
    caption: "Draft de test",
    mediaObjectPath: imagePath,
    http: async () => {
      replayCalls += 1;
      return { status: 200, body: {} };
    },
    claim: async () => ({ outcome: "replay", jobId: "job-1", publishId, status: "pending" }),
    createGrant: async () => null,
    loadToken: async () => null,
    settle: async () => true,
  });
  assert.equal(replay.outcome, "replay");
  assert.equal(replay.externalCall, false);
  assert.equal(replayCalls, 0);

  let unsavedCalls = 0;
  const unsaved = await performTikTokDraftTest({
    access: { ok: true },
    caption: "Draft de test",
    mediaObjectPath: imagePath,
    http: async () => {
      unsavedCalls += 1;
      return { status: 200, body: { data: { publish_id: publishId }, error: { code: "ok" } } };
    },
    claim: async () => ({ outcome: "claimed", jobId: "job-3" }),
    createGrant: async () => ({ imageUrl: draftImageUrl(createMediaToken()) }),
    loadToken: async () => ({ accessToken: "access-value", scopes: ["user.info.basic", "video.upload"] }),
    settle: async () => false,
  });
  assert.equal(unsaved.outcome, "needs_reconcile");
  assert.equal(unsaved.publishId, publishId);
  assert.equal(unsavedCalls, 1);
});

test("an ambiguous TikTok response is reconciled once and is not retried", async () => {
  let calls = 0;
  const settled = [];
  const dropped = await performTikTokDraftTest({
    access: { ok: true },
    caption: "Draft de test",
    mediaObjectPath: imagePath,
    http: async () => {
      calls += 1;
      throw new Error("socket hang up access-value");
    },
    claim: async () => ({ outcome: "claimed", jobId: "job-2" }),
    createGrant: async () => ({ imageUrl: draftImageUrl(createMediaToken()) }),
    loadToken: async () => ({ accessToken: "access-value", scopes: ["user.info.basic", "video.upload"] }),
    settle: async (_job, patch) => {
      settled.push(patch);
      return true;
    },
  });
  assert.equal(dropped.outcome, "needs_reconcile");
  assert.equal(dropped.attempts, 1);
  assert.equal(calls, 1);
  assert.equal(settled[0].kind, "ambiguous");

  let limitedCalls = 0;
  const limited = await initTikTokPhotoInbox({
    http: async () => {
      limitedCalls += 1;
      return { status: 429, body: { error: { code: "rate_limit_exceeded", message: "slow down access-value" } } };
    },
    accessToken: "access-value",
    scopes: ["user.info.basic", "video.upload"],
    capabilityEnabled: false,
    draftTest: true,
    liveEnabled: true,
    maxAttempts: 1,
    caption: "Draft de test",
    imageUrl: draftImageUrl(createMediaToken()),
  });
  assert.equal(limited.ok, false);
  if (!limited.ok) {
    assert.equal(limited.reason, "rate_limited");
    assert.equal(limited.ambiguous, false);
  }
  assert.equal(limitedCalls, 1);
  const server = await initTikTokPhotoInbox({
    http: async () => ({ status: 500, body: { error: { code: "internal_error", message: "access-value" } } }),
    accessToken: "access-value",
    scopes: ["user.info.basic", "video.upload"],
    capabilityEnabled: false,
    draftTest: true,
    liveEnabled: true,
    maxAttempts: 1,
    caption: "Draft de test",
    imageUrl: draftImageUrl(createMediaToken()),
  });
  assert.equal(server.ok, false);
  if (!server.ok) assert.equal(server.ambiguous, true);
});

test("one unidentified unknown job does not block a different draft key", () => {
  const migration = readFileSync(join(root, "supabase/migrations/20261112103000_frizeo_v2_tiktok_second_draft.sql"), "utf8");
  const index = migration.slice(migration.indexOf("create unique index"), migration.indexOf("create or replace function"));
  assert.match(index, /'initiating', 'pending', 'publishing'/);
  assert.equal(index.includes("'unknown'"), false);
  assert.match(migration, /v_unknown >= 2/);
  assert.match(migration, /status = 'unknown'/);
  assert.match(migration, /provider_post_id is null/);
  assert.equal(migration.includes("1eeeaa87-9a8c-49eb-8a60-459ed0b7034d"), false);
  assert.equal(migration.includes("update public.integration_publish_jobs"), false);
});

test("a square above 1080p is fitted to the official photo frame", async () => {
  assert.deepEqual(tikTokPhotoFrame(1254, 1254), { width: 1080, height: 1080 });
  assert.deepEqual(tikTokPhotoFrame(3000, 2000), { width: 1620, height: 1080 });
  assert.deepEqual(tikTokPhotoFrame(1000, 2000), { width: 960, height: 1920 });
  assert.equal(tikTokPhotoFrame(64, 48)?.width, 64);
  const source = await sharp({
    create: { width: 1254, height: 1254, channels: 3, background: { r: 240, g: 20, b: 20 } },
  }).jpeg({ chromaSubsampling: "4:4:4" }).toBuffer();
  const normalized = await normalizeTikTokPhoto(source);
  assert.ok(normalized);
  const meta = await sharp(normalized).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width, 1080);
  assert.equal(meta.height, 1080);
  assert.equal(meta.orientation ?? null, null);
  const png = await sharp({
    create: { width: 2000, height: 1000, channels: 3, background: { r: 1, g: 2, b: 3 } },
  }).png().toBuffer();
  const converted = await normalizeTikTokPhoto(png);
  assert.ok(converted);
  const convertedMeta = await sharp(converted).metadata();
  assert.equal(convertedMeta.format, "jpeg");
  assert.equal(convertedMeta.width <= 1920 && convertedMeta.height <= 1080, true);
  assert.equal(await normalizeTikTokPhoto(Buffer.from("not-a-jpeg")), null);
});

test("failed TikTok jobs release the destination and keep the publish id", () => {
  const migration = readFileSync(join(root, "supabase/migrations/20261112115000_frizeo_v2_tiktok_photo_size.sql"), "utf8");
  const index = migration.slice(
    migration.indexOf("create unique index integration_publish_jobs_live_open_destination_uidx"),
    migration.indexOf("create or replace function public.tiktok_draft_settle"),
  );
  assert.match(index, /provider <> 'tiktok'/);
  assert.match(index, /'pending', 'publishing', 'unknown'/);
  assert.match(migration, /when unique_violation then/);
  assert.match(migration, /outcome', 'publish_saved'/);
  const settle = migration.slice(
    migration.indexOf("create or replace function public.tiktok_draft_settle"),
    migration.indexOf("create or replace function public.tiktok_draft_reconcile"),
  );
  assert.equal(settle.includes("provider_post_id = null"), false);
  assert.match(migration, /picture_size_check_failed/);
  assert.match(migration, /p_inbox_url~v2\.7707199245161351190/);
  assert.equal(migration.includes("tenant_capabilities"), false);
  assert.equal(migration.includes("video.publish"), false);
  assert.equal(migration.includes("marketing.publish.tiktok"), false);
});

test("the draft migration does not enable publishing or direct post", () => {
  const migration = readFileSync(join(root, "supabase/migrations/20261112093000_frizeo_v2_tiktok_draft_test.sql"), "utf8");
  const mediaRoute = readFileSync(join(root, "app/api/integrations/tiktok/media/[token]/route.ts"), "utf8");
  assert.equal(migration.includes("tenant_capabilities"), false);
  assert.match(migration, /'initiating'/);
  assert.match(migration, /needs_reconcile/);
  assert.match(migration, /direct_post_inactive/);
  assert.equal(migration.includes(demo), true);
  assert.doesNotMatch(mediaRoute, /createSignedUrl|service_role|access_token/);
});
