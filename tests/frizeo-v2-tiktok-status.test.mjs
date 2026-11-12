import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DEMO_BARBER_TENANT_ID } from "../lib/integrations/tiktok/draftTest.ts";
import {
  TIKTOK_KNOWN_STATUS_IDEMPOTENCY_KEY,
  TIKTOK_KNOWN_STATUS_JOB_ID,
  TIKTOK_KNOWN_STATUS_PUBLISH_ID,
  decideTikTokStatusAccess,
  tikTokStatusRecord,
  fetchKnownTikTokDraftStatus,
  knownTikTokStatusJobMatches,
  performKnownTikTokStatusCheck,
  requestedKnownPublishId,
} from "../lib/integrations/tiktok/statusCheck.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const demo = DEMO_BARBER_TENANT_ID;
const owner = "5edac115-6694-4917-ab04-0c02cd7e2f77";
const other = "11111111-1111-1111-1111-111111111111";
const connectionId = "22222222-2222-2222-2222-222222222222";
const token = "access-value-not-for-logs";

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
    ...overrides,
  };
}

function job(overrides = {}) {
  return {
    id: TIKTOK_KNOWN_STATUS_JOB_ID,
    tenantId: demo,
    provider: "tiktok",
    idempotencyKey: TIKTOK_KNOWN_STATUS_IDEMPOTENCY_KEY,
    destinationTenantId: demo,
    destinationProvider: "tiktok",
    destinationConnectionId: connectionId,
    connectionId,
    providerPostId: null,
    ...overrides,
  };
}

function slice(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.equal(from >= 0 && to > from, true);
  return source.slice(from, to);
}

test("status access stays on staging for the demo owner who connected TikTok", () => {
  assert.equal(decideTikTokStatusAccess(allowed()).ok, true);
  assert.equal(decideTikTokStatusAccess(allowed({ production: true })).status, 404);
  assert.equal(decideTikTokStatusAccess(allowed({ stagingHost: false })).status, 404);
  assert.equal(decideTikTokStatusAccess(allowed({ authenticated: false, userId: null })).status, 401);
  assert.equal(decideTikTokStatusAccess(allowed({ tenantId: other })).error, "forbidden");
  assert.equal(decideTikTokStatusAccess(allowed({ userId: other })).error, "forbidden");
  assert.equal(decideTikTokStatusAccess(allowed({ role: "staff" })).error, "forbidden");
  assert.equal(decideTikTokStatusAccess(allowed({ configured: false })).error, "unconfigured");
  assert.equal(requestedKnownPublishId({ publishId: TIKTOK_KNOWN_STATUS_PUBLISH_ID }), TIKTOK_KNOWN_STATUS_PUBLISH_ID);
  assert.equal(requestedKnownPublishId({ publishId: "p_pub_url~v2.123456789" }), null);
  assert.equal(requestedKnownPublishId({}), null);
  assert.equal(requestedKnownPublishId({
    publishId: TIKTOK_KNOWN_STATUS_PUBLISH_ID,
    publish_id: "v_other_id~v2.123456789",
  }), null);
});

test("the known job must belong to the demo tenant and its TikTok connection", () => {
  assert.equal(knownTikTokStatusJobMatches(job(), demo), true);
  assert.equal(knownTikTokStatusJobMatches(job({ providerPostId: TIKTOK_KNOWN_STATUS_PUBLISH_ID }), demo), true);
  assert.equal(knownTikTokStatusJobMatches(job({ tenantId: other }), demo), false);
  assert.equal(knownTikTokStatusJobMatches(job({ destinationTenantId: other }), demo), false);
  assert.equal(knownTikTokStatusJobMatches(job({ destinationConnectionId: other }), demo), false);
  assert.equal(knownTikTokStatusJobMatches(job({ idempotencyKey: "draft-jpeg-frizeo-app-01" }), demo), false);
  assert.equal(knownTikTokStatusJobMatches(job({ providerPostId: "p_pub_url~v2.123456789" }), demo), false);
  assert.equal(knownTikTokStatusJobMatches(job(), other), false);
});

test("a status read calls the official endpoint once and does not query another id", async () => {
  const calls = [];
  const logs = [];
  const original = console.error;
  console.error = (line) => logs.push(String(line));
  try {
    const result = await fetchKnownTikTokDraftStatus({
      accessToken: token,
      publishId: TIKTOK_KNOWN_STATUS_PUBLISH_ID,
      http: async (request) => {
        calls.push(request);
        return {
          status: 200,
          body: {
            data: { status: "FAILED", fail_reason: "photo_pull_failed" },
            error: { code: "ok", message: `token ${token}` },
          },
        };
      },
    });
    assert.equal(result.externalCall, true);
    assert.equal(result.status, "FAILED");
    assert.equal(result.failReason, "photo_pull_failed");
    assert.equal(result.tikTokCode, "ok");
    assert.equal(result.tikTokMessage.includes(token), false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://open.tiktokapis.com/v2/post/publish/status/fetch/");
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(JSON.parse(calls[0].body), { publish_id: TIKTOK_KNOWN_STATUS_PUBLISH_ID });
    assert.equal(logs.some((line) => line.includes(token) || line.includes("Authorization")), false);

    calls.length = 0;
    const otherId = await fetchKnownTikTokDraftStatus({
      accessToken: token,
      publishId: "p_pub_url~v2.123456789",
      http: async (request) => {
        calls.push(request);
        return { status: 200, body: {} };
      },
    });
    assert.equal(otherId.externalCall, false);
    assert.equal(calls.length, 0);

    const network = await fetchKnownTikTokDraftStatus({
      accessToken: token,
      publishId: TIKTOK_KNOWN_STATUS_PUBLISH_ID,
      http: async () => {
        calls.push("network");
        throw new Error("timeout");
      },
    });
    assert.equal(network.error, "network");
    assert.equal(network.externalCall, true);
    assert.equal(calls.length, 1);
  } finally {
    console.error = original;
  }
});

test("ownership and scope are checked before any TikTok call or token decrypt", async () => {
  let reads = 0;
  let decrypts = 0;
  let calls = 0;
  const http = async () => {
    calls += 1;
    return { status: 200, body: { data: { status: "SEND_TO_USER_INBOX" }, error: { code: "ok", message: "" } } };
  };
  const denied = await performKnownTikTokStatusCheck({
    access: decideTikTokStatusAccess(allowed({ configured: false })),
    publishId: TIKTOK_KNOWN_STATUS_PUBLISH_ID,
    http,
    readJob: async () => {
      reads += 1;
      return job();
    },
    readScopes: () => ["user.info.basic", "video.upload"],
    loadToken: async () => {
      decrypts += 1;
      return token;
    },
  });
  assert.equal(denied.error, "unconfigured");
  assert.equal(denied.externalCall, false);

  const wrongId = await performKnownTikTokStatusCheck({
    access: { ok: true },
    publishId: null,
    http,
    readJob: async () => {
      reads += 1;
      return job();
    },
    readScopes: () => ["user.info.basic", "video.upload"],
    loadToken: async () => {
      decrypts += 1;
      return token;
    },
  });
  assert.equal(wrongId.error, "unknown_publish_id");

  const mismatch = await performKnownTikTokStatusCheck({
    access: { ok: true },
    publishId: TIKTOK_KNOWN_STATUS_PUBLISH_ID,
    http,
    readJob: async () => {
      reads += 1;
      return job({ tenantId: other });
    },
    readScopes: () => ["user.info.basic", "video.upload"],
    loadToken: async () => {
      decrypts += 1;
      return token;
    },
  });
  assert.equal(mismatch.error, "job_mismatch");
  assert.equal(reads, 1);
  assert.equal(decrypts, 0);

  const publishScope = await performKnownTikTokStatusCheck({
    access: { ok: true },
    publishId: TIKTOK_KNOWN_STATUS_PUBLISH_ID,
    http,
    readJob: async () => job(),
    readScopes: () => ["user.info.basic", "video.upload", "video.publish"],
    loadToken: async () => {
      decrypts += 1;
      return token;
    },
  });
  assert.equal(publishScope.error, "direct_post_inactive");
  assert.equal(decrypts, 0);
  assert.equal(calls, 0);

  const ready = await performKnownTikTokStatusCheck({
    access: { ok: true },
    publishId: TIKTOK_KNOWN_STATUS_PUBLISH_ID,
    http,
    readJob: async () => job(),
    readScopes: () => ["user.info.basic", "video.upload"],
    loadToken: async () => {
      decrypts += 1;
      return token;
    },
  });
  assert.equal(ready.status, "SEND_TO_USER_INBOX");
  assert.equal(ready.failReason, null);
  assert.equal(ready.externalCall, true);
  assert.equal(calls, 1);
  assert.equal(decrypts, 1);
  assert.equal(JSON.stringify(ready).includes(token), false);

  const recorded = [];
  const failed = await performKnownTikTokStatusCheck({
    access: { ok: true },
    publishId: TIKTOK_KNOWN_STATUS_PUBLISH_ID,
    http: async () => ({
      status: 200,
      body: {
        data: { status: "FAILED", fail_reason: "picture_size_check_failed" },
        error: { code: "ok", message: "" },
      },
    }),
    readJob: async () => job(),
    readScopes: () => ["user.info.basic", "video.upload"],
    loadToken: async () => token,
    recordStatus: async (record) => {
      recorded.push(record);
      return true;
    },
  });
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.failReason, "picture_size_check_failed");
  assert.equal(failed.saved, true);
  assert.deepEqual(recorded, [{ status: "failed", safeError: "picture_size_check_failed" }]);
  assert.deepEqual(tikTokStatusRecord({ status: "FAILED", failReason: "not a code" }), {
    status: "failed",
    safeError: "provider_error",
  });
  assert.equal(tikTokStatusRecord({ status: "SEND_TO_USER_INBOX", failReason: null })?.status, "pending");
});

test("the route is a manual staging POST and does not write jobs or enable publish", () => {
  const route = readFileSync(join(root, "app/api/integrations/tiktok/draft-status/route.ts"), "utf8");
  const handler = readFileSync(join(root, "lib/integrations/tiktok/statusHandlers.ts"), "utf8");
  const check = readFileSync(join(root, "lib/integrations/tiktok/statusCheck.ts"), "utf8");
  const store = readFileSync(join(root, "lib/integrations/tiktok/store.ts"), "utf8");
  const reader = slice(store, "export async function readKnownTikTokStatusJob", "export async function reconcileTikTokDraftStatus");
  assert.equal(route.includes("export function POST"), true);
  assert.equal(route.includes("export function GET"), false);
  assert.equal(route.includes("readKnownTikTokDraftStatus(request)"), true);
  assert.equal(check.includes("https://open.tiktokapis.com/v2/post/publish/content/init/"), false);
  assert.equal(check.includes("marketing.publish.tiktok"), false);
  assert.equal(check.includes("capabilityEnabled"), false);
  assert.equal(handler.includes("settleTikTokDraft"), false);
  assert.equal(handler.includes("claimTikTokDraft"), false);
  assert.equal(reader.includes(".update("), false);
  assert.equal(reader.includes(".insert("), false);
  assert.equal(reader.includes(".delete("), false);
  assert.equal(reader.includes("tiktok_draft_settle"), false);
  assert.equal(reader.includes("TIKTOK_KNOWN_STATUS_JOB_ID"), true);
  assert.equal(reader.includes(".rpc("), false);
  assert.equal(check.includes(TIKTOK_KNOWN_STATUS_PUBLISH_ID), true);
  assert.equal(check.includes("TIKTOK_STATUS_URL"), true);
});
