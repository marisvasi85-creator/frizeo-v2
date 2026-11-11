import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { TIKTOK_CONTENT_POSTING_LIVE, TIKTOK_DIRECT_POST_ENABLED } from "../lib/integrations/tiktok/config.ts";
import {
  acceptTikTokScopes,
  buildTikTokAuthorizeUrl,
  directPostConsent,
  encodePkceMaterial,
  readPkceMaterial,
  scopesForConsent,
} from "../lib/integrations/tiktok/flow.ts";
import { getProviderAdapter } from "../lib/integrations/providers/registry.ts";
import {
  buildPhotoDirectRequest,
  buildPhotoInboxRequest,
  buildVideoInboxRequest,
  directPostPrivacy,
  fetchTikTokPublishStatus,
  initTikTokDirectPost,
  initTikTokPhotoInbox,
  initTikTokVideoInbox,
  interpretTikTokStatus,
  tikTokIdempotencyDecision,
  tikTokMediaUrl,
} from "../lib/integrations/tiktok/posting.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const image = "https://staging.frizeo.ro/media/post.jpg";
const publishId = "v_pub_url~v2.123456789";

test("upload consent is explicit and direct post stays inactive", () => {
  assert.equal(TIKTOK_DIRECT_POST_ENABLED, false);
  assert.equal(TIKTOK_CONTENT_POSTING_LIVE, false);
  assert.deepEqual(directPostConsent(), { ok: false, reason: "direct_post_inactive" });
  assert.equal(scopesForConsent("identity"), "user.info.basic");
  assert.equal(scopesForConsent("upload"), "user.info.basic,video.upload");
  const uploadUrl = new URL(buildTikTokAuthorizeUrl({
    config: {
      clientKey: "staging-key",
      redirectUri: "https://staging.frizeo.ro/api/integrations/tiktok/callback",
      scope: "user.info.basic",
    },
    state: "state-token",
    codeChallenge: "challenge",
    scope: scopesForConsent("upload"),
  }));
  assert.equal(uploadUrl.searchParams.get("scope"), "user.info.basic,video.upload");
  assert.equal(uploadUrl.search.includes("video.publish"), false);
  assert.throws(() => buildTikTokAuthorizeUrl({
    config: {
      clientKey: "staging-key",
      redirectUri: "https://staging.frizeo.ro/api/integrations/tiktok/callback",
      scope: "user.info.basic",
    },
    state: "state-token",
    codeChallenge: "challenge",
    scope: "user.info.basic,video.publish",
  }));
  const material = readPkceMaterial(encodePkceMaterial("a".repeat(43), "upload"));
  assert.deepEqual(material, { verifier: "a".repeat(43), consent: "upload" });
  assert.equal(acceptTikTokScopes(["user.info.basic", "video.upload"], "identity").reason, "upload_not_requested");
  assert.equal(acceptTikTokScopes(["user.info.basic", "video.publish"], "upload").reason, "publish_scope");
  const granted = acceptTikTokScopes(["user.info.basic"], "upload");
  assert.equal(granted.ok, true);
  if (granted.ok) assert.equal(granted.grantedUpload, false);
});

test("photo inbox stays local unless a test explicitly enables the call", async () => {
  let calls = 0;
  const http = async () => {
    calls += 1;
    return { status: 200, body: { data: { publish_id: publishId }, error: { code: "ok" } } };
  };
  const closed = await initTikTokPhotoInbox({
    http,
    accessToken: "access-value",
    scopes: ["user.info.basic", "video.upload"],
    capabilityEnabled: false,
    caption: "Program de vineri",
    imageUrl: image,
  });
  assert.deepEqual(closed, { ok: false, reason: "capability_off", externalCall: false, attempts: 0 });
  const liveOff = await initTikTokPhotoInbox({
    http,
    accessToken: "access-value",
    scopes: ["user.info.basic", "video.upload"],
    capabilityEnabled: true,
    caption: "Program de vineri",
    imageUrl: image,
  });
  assert.equal(liveOff.reason, "live_off");
  assert.equal(calls, 0);
  const missingScope = await initTikTokPhotoInbox({
    http,
    accessToken: "access-value",
    scopes: ["user.info.basic"],
    capabilityEnabled: true,
    liveEnabled: true,
    caption: "Program de vineri",
    imageUrl: image,
  });
  assert.equal(missingScope.reason, "upload_scope_required");
  assert.equal(calls, 0);
  assert.equal(tikTokMediaUrl("http://staging.frizeo.ro/a.jpg", "photo"), null);
  assert.equal(tikTokMediaUrl(`${image}?access_token=secret`, "photo"), null);
});

test("a simulated inbox upload retries only a dropped request and keeps one publish id", async () => {
  let calls = 0;
  const started = await initTikTokPhotoInbox({
    http: async (request) => {
      calls += 1;
      const body = JSON.parse(request.body);
      assert.equal(body.post_mode, "MEDIA_UPLOAD");
      assert.equal(body.media_type, "PHOTO");
      assert.deepEqual(body.source_info.photo_images, [image]);
      assert.equal(request.headers.Authorization, "Bearer access-value");
      if (calls === 1) throw new Error("socket hang up access-value");
      return { status: 200, body: { data: { publish_id: publishId }, error: { code: "ok" } } };
    },
    accessToken: "access-value",
    scopes: ["user.info.basic", "video.upload"],
    capabilityEnabled: true,
    liveEnabled: true,
    caption: "Program de vineri",
    imageUrl: image,
  });
  assert.equal(started.ok, true);
  if (started.ok) assert.equal(started.publishId, publishId);
  assert.equal(started.attempts, 2);

  let limitedCalls = 0;
  const limited = await initTikTokPhotoInbox({
    http: async () => {
      limitedCalls += 1;
      return { status: 429, body: { error: { code: "rate_limit_exceeded", message: "slow down access-value" } } };
    },
    accessToken: "access-value",
    scopes: ["user.info.basic", "video.upload"],
    capabilityEnabled: true,
    liveEnabled: true,
    caption: "Program de vineri",
    imageUrl: image,
  });
  assert.equal(limited.ok, false);
  if (!limited.ok) assert.equal(limited.reason, "rate_limited");
  assert.equal(limitedCalls, 1);

  const duplicate = await initTikTokPhotoInbox({
    http: async () => {
      throw new Error("should not send twice");
    },
    accessToken: "access-value",
    scopes: ["user.info.basic", "video.upload"],
    capabilityEnabled: true,
    liveEnabled: true,
    existingPublishId: publishId,
    caption: "Program de vineri",
    imageUrl: image,
  });
  assert.equal(duplicate.reason, "already_started");
  assert.equal(duplicate.externalCall, false);
});

test("direct post and video upload are prepared but never sent", async () => {
  let calls = 0;
  const http = async () => {
    calls += 1;
    return { status: 200, body: {} };
  };
  assert.deepEqual(await initTikTokDirectPost({ http }), {
    ok: false,
    reason: "direct_post_inactive",
    externalCall: false,
    attempts: 0,
  });
  assert.deepEqual(await initTikTokVideoInbox(), {
    ok: false,
    reason: "video_not_enabled",
    externalCall: false,
    attempts: 0,
  });
  assert.equal(calls, 0);
  const direct = buildPhotoDirectRequest({
    title: "Titlu",
    description: "Descriere",
    imageUrl: image,
  });
  assert.equal(direct.post_mode, "DIRECT_POST");
  assert.equal(direct.post_info.privacy_level, "SELF_ONLY");
  assert.equal(JSON.stringify(direct).includes("PUBLIC_TO_EVERYONE"), false);
  assert.equal(buildPhotoInboxRequest({
    title: "Titlu",
    description: "Descriere",
    imageUrl: image,
  }).post_mode, "MEDIA_UPLOAD");
  assert.equal(buildVideoInboxRequest("https://staging.frizeo.ro/clip.mp4").source_info.video_url.endsWith(".mp4"), true);
  assert.deepEqual(directPostPrivacy(["PUBLIC_TO_EVERYONE"]), { ok: false, reason: "unaudited_private_only" });
  assert.deepEqual(directPostPrivacy(["SELF_ONLY"]), { ok: true, privacy: "SELF_ONLY" });
});

test("status checks do not mark an inbox draft as a public post", async () => {
  assert.deepEqual(interpretTikTokStatus("SEND_TO_USER_INBOX"), { outcome: "inbox_ready", published: false });
  assert.equal(interpretTikTokStatus("PUBLISH_COMPLETE").published, false);
  let calls = 0;
  const status = await fetchTikTokPublishStatus({
    http: async () => {
      calls += 1;
      if (calls === 1) throw new Error("timeout");
      return {
        status: 200,
        body: { data: { status: "SEND_TO_USER_INBOX" }, error: { code: "ok", message: "" } },
      };
    },
    accessToken: "access-value",
    publishId,
    capabilityEnabled: true,
    liveEnabled: true,
  });
  assert.equal(status.ok, true);
  if (status.ok) {
    assert.equal(status.outcome, "inbox_ready");
    assert.equal(status.published, false);
  }
  assert.equal(calls, 2);
  const closed = await fetchTikTokPublishStatus({
    http: async () => {
      throw new Error("should not run");
    },
    accessToken: "access-value",
    publishId,
    capabilityEnabled: false,
  });
  assert.equal(closed.reason, "capability_off");
  assert.equal(closed.externalCall, false);
});

test("idempotency replays the same draft and conflicts when the caption changes", () => {
  assert.equal(tikTokIdempotencyDecision({
    existing: null,
    caption: "A",
    mediaPath: "path",
  }), "create");
  assert.equal(tikTokIdempotencyDecision({
    existing: { caption: "A", mediaPath: "path", executionMode: "mock" },
    caption: "A",
    mediaPath: "path",
  }), "replay");
  assert.equal(tikTokIdempotencyDecision({
    existing: { caption: "A", mediaPath: "path", executionMode: "mock" },
    caption: "B",
    mediaPath: "path",
  }), "conflict");
});

test("tiktok posting does not open the lab adapter or enable the capability", async () => {
  assert.deepEqual(await getProviderAdapter("tiktok").publish(), {
    implemented: false,
    reason: "not_implemented",
  });
  const migration = readFileSync(join(root, "supabase/migrations/20261111193000_frizeo_v2_tiktok_content_posting.sql"), "utf8");
  const route = readFileSync(join(root, "app/api/integrations/tiktok/publish/mock/route.ts"), "utf8");
  assert.equal(migration.includes("tenant_capabilities"), false);
  assert.equal(migration.includes("integration_oauth_state_consume"), false);
  assert.equal(migration.includes("execution_mode,\n    attempts"), true);
  assert.match(migration, /'mock'/);
  assert.doesNotMatch(route, /open\.tiktokapis\.com/);
  assert.equal(migration.includes("video.publish"), true);
  assert.match(migration, /direct_post_inactive/);
});
