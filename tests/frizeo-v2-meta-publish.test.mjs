import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { buildAdminNavItems } from "../app/admin/components/adminNav.ts";
import { FRIZEO_V2_CAPABILITIES, resolveCapabilities } from "../lib/integrations/capabilities.ts";
import { createGraphBudget, GRAPH_BUDGET_MS, GRAPH_CALL_MAX_MS } from "../lib/integrations/meta/graph.ts";
import { publishFacebookPhoto } from "../lib/integrations/meta/publish/facebook.ts";
import { publishRequestDecision } from "../lib/integrations/meta/publish/flags.ts";
import { buildGraphUrl, createMetaPublishHttp } from "../lib/integrations/meta/publish/graphHttp.ts";
import {
  isMetaFetchableImageUrl,
  marketingImagePath,
  prepareMarketingImage,
  sniffImageMime,
  validateCaption,
} from "../lib/integrations/meta/publish/image.ts";
import {
  createInstagramContainer,
  INSTAGRAM_CONTAINER_TIMEOUT_MS,
  listInstagramMedia,
  publishInstagramContainer,
  readInstagramStatus,
} from "../lib/integrations/meta/publish/instagram.ts";
import { averageHash, hashDistance, isInstagramCdnUrl, rankInstagramPosts } from "../lib/integrations/meta/publish/instagramLookup.ts";
import { INSTAGRAM_NOT_FOUND, matchInstagramPosts } from "../lib/integrations/meta/publish/instagramMatch.ts";
import { advancePublishJobs } from "../lib/integrations/meta/publish/orchestrate.ts";
import { publicJobResponse } from "../lib/integrations/meta/publish/present.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const USER = "USER_TOKEN_SHOULD_NOT_LEAK";
const PAGE = "PAGE_TOKEN_SHOULD_NOT_LEAK";
const IMAGE = "https://fanxxytfuhnakfdzwssd.supabase.co/storage/v1/object/sign/marketing-publish/5d9862a1-fd85-46f2-9c7e-635e813e067c/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg?token=signed";
const SCOPES = [
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "pages_read_engagement",
  "pages_show_list",
  "business_management",
];

function job(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    destinationType: "facebook_page",
    providerDestinationId: "12345",
    status: "pending",
    executionMode: "live",
    attempts: 0,
    providerPostId: null,
    providerContainerId: null,
    safeError: null,
    ...overrides,
  };
}

function memoryStore(initial) {
  const jobs = new Map(initial.map((item) => [item.id, { ...item }]));
  let chain = Promise.resolve();
  function lock(fn) {
    const run = chain.then(fn, fn);
    chain = run.then(() => undefined, () => undefined);
    return run;
  }
  function allowed(current, patch) {
    if (current.executionMode !== "live") return false;
    if (
      current.providerContainerId &&
      patch.providerContainerId &&
      current.providerContainerId !== patch.providerContainerId
    ) {
      return false;
    }
    const post = patch.providerPostId ?? null;
    const error = patch.safeError ?? null;
    const container = patch.providerContainerId ?? null;
    if (current.status === "publishing" && patch.status === "publishing" && !post && container && !error) {
      return true;
    }
    if (current.status === "publishing" && patch.status === "published" && post && !error) return true;
    if (current.status === "publishing" && patch.status === "failed" && !post && error) return true;
    if (current.status === "publishing" && patch.status === "unknown" && !post && error) return true;
    if (current.status === "unknown" && patch.status === "published" && post && !error) return true;
    if (current.status === "unknown" && patch.status === "failed" && !post && error) return true;
    return false;
  }
  return {
    jobs,
    claim: (id) => lock(async () => {
      const current = jobs.get(id);
      if (!current) return { outcome: "not_found" };
      if (current.executionMode !== "live" || current.status !== "pending" || current.attempts !== 0) {
        return { outcome: "held", job: { ...current } };
      }
      current.status = "publishing";
      current.attempts += 1;
      return { outcome: "claimed", job: { ...current } };
    }),
    settle: (id, patch) => lock(async () => {
      const current = jobs.get(id);
      if (!current) return { outcome: "not_found" };
      if (!allowed(current, patch)) return { outcome: "rejected", job: { ...current } };
      current.status = patch.status;
      if (patch.providerPostId) current.providerPostId = patch.providerPostId;
      if (patch.providerContainerId) current.providerContainerId = patch.providerContainerId;
      current.safeError = patch.status === "published" ? null : patch.safeError ?? null;
      return { outcome: "updated", job: { ...current } };
    }),
    claimFinished: (id, containerId) => lock(async () => {
      const current = jobs.get(id);
      if (!current) return { outcome: "not_found" };
      if (
        current.executionMode !== "live" ||
        current.status !== "publishing" ||
        current.providerPostId ||
        current.safeError ||
        current.providerContainerId !== containerId ||
        !/^[0-9]{1,32}$/.test(containerId)
      ) {
        return { outcome: "held", job: { ...current } };
      }
      current.safeError = "publish_in_flight";
      return { outcome: "claimed", job: { ...current } };
    }),
  };
}

function recorder(reply) {
  const calls = [];
  return {
    calls,
    async http(call) {
      calls.push(call);
      const result = await reply(call, calls);
      return result;
    },
  };
}

function baseInput(store, http, overrides = {}) {
  return {
    mode: "start",
    liveAllowed: true,
    userToken: USER,
    scopes: SCOPES,
    appSecret: "app-secret-not-a-token",
    caption: "Programări deschise",
    tokenExpiresAt: "2099-01-01T00:00:00.000Z",
    http,
    claim: store.claim,
    claimFinished: store.claimFinished,
    settle: store.settle,
    signImage: async () => IMAGE,
    ...overrides,
  };
}

function assertNoSecrets(value) {
  const text = JSON.stringify(value);
  assert.equal(text.includes(USER), false);
  assert.equal(text.includes(PAGE), false);
  assert.equal(text.includes("app-secret-not-a-token"), false);
}

test("live capability stays off unless a row enables it", () => {
  assert.equal(FRIZEO_V2_CAPABILITIES.includes("marketing.publish.meta.live"), true);
  const defaults = resolveCapabilities([]);
  assert.equal(defaults["marketing.publish.meta.live"], false);
  assert.equal(defaults["marketing.publish.meta"], false);
  const integrationOnly = resolveCapabilities([
    { capability: "marketing.publish.meta", enabled: true },
  ]);
  assert.equal(integrationOnly["marketing.publish.meta"], true);
  assert.equal(integrationOnly["marketing.publish.meta.live"], false);
});

test("publish navigation is owner and manager only", () => {
  const barber = buildAdminNavItems({ role: "barber", actsAsBarber: true });
  const manager = buildAdminNavItems({ role: "manager", actsAsBarber: true });
  const owner = buildAdminNavItems({ role: "owner", actsAsBarber: false });
  assert.equal(barber.some((item) => item.href === "/admin/marketing/publish"), false);
  assert.equal(manager.some((item) => item.href === "/admin/marketing/publish"), true);
  assert.equal(owner.some((item) => item.href === "/admin/marketing/publish"), true);
});

test("publish gates fail closed", () => {
  const ready = {
    production: false,
    hostIsStaging: true,
    originAllowed: true,
    authenticated: true,
    role: "owner",
    integrationEnabled: true,
    liveCapabilityEnabled: true,
    envLiveEnabled: true,
    configured: true,
    action: "live",
  };
  assert.deepEqual(publishRequestDecision(ready), { ok: true });
  assert.equal(publishRequestDecision({ ...ready, production: true }).status, 404);
  assert.equal(publishRequestDecision({ ...ready, hostIsStaging: false }).status, 404);
  assert.equal(publishRequestDecision({ ...ready, role: "barber" }).error, "forbidden");
  assert.equal(publishRequestDecision({ ...ready, role: null }).error, "forbidden");
  assert.equal(publishRequestDecision({ ...ready, integrationEnabled: false }).error, "capability_off");
  assert.equal(publishRequestDecision({ ...ready, liveCapabilityEnabled: false }).error, "live_off");
  assert.equal(publishRequestDecision({ ...ready, envLiveEnabled: false }).error, "live_off");
  assert.equal(publishRequestDecision({ ...ready, configured: false }).error, "unconfigured");
  assert.equal(publishRequestDecision({ ...ready, originAllowed: false }).error, "origin");
  assert.equal(publishRequestDecision({ ...ready, authenticated: false }).status, 401);
  assert.deepEqual(
    publishRequestDecision({ ...ready, action: "mock", liveCapabilityEnabled: false, envLiveEnabled: false }),
    { ok: true },
  );
  assert.equal(
    publishRequestDecision({ ...ready, action: "verify", envLiveEnabled: false }).error,
    "live_off",
  );
  assert.equal(
    publishRequestDecision({ ...ready, action: "lookup", envLiveEnabled: false }).error,
    "live_off",
  );
  assert.equal(
    publishRequestDecision({ ...ready, action: "reconcile", production: true }).status,
    404,
  );
  assert.deepEqual(
    publishRequestDecision({ ...ready, action: "release", liveCapabilityEnabled: false, envLiveEnabled: false, configured: false }),
    { ok: true },
  );
  assert.equal(INSTAGRAM_CONTAINER_TIMEOUT_MS, 5000);
  assert.equal(GRAPH_CALL_MAX_MS, 1500);
  assert.equal(GRAPH_BUDGET_MS, 8000);
  assert.ok(INSTAGRAM_CONTAINER_TIMEOUT_MS + (GRAPH_CALL_MAX_MS * 2) <= GRAPH_BUDGET_MS);
  assert.ok(GRAPH_BUDGET_MS < 10_000);
});

test("graph urls never carry the access token", () => {
  const url = buildGraphUrl("123/photos", { appsecret_proof: "abc" });
  assert.equal(url.startsWith("https://graph.facebook.com/v26.0/123/photos"), true);
  assert.equal(url.includes("access_token"), false);
  assert.throws(() => buildGraphUrl("123/photos", { access_token: USER }));
  assert.throws(() => buildGraphUrl("me/accounts", {}));
  assert.throws(() => buildGraphUrl("../oauth/access_token", {}));
});

test("facebook success uses an in-memory page token and returns the post id", async () => {
  const seen = recorder(async (call) => {
    if (call.method === "GET") {
      return { ok: true, status: 200, body: { access_token: PAGE, tasks: ["CREATE_CONTENT"] } };
    }
    assert.equal(call.token, PAGE);
    assert.equal(call.form.url, IMAGE);
    assert.equal(call.path, "12345/photos");
    return { ok: true, status: 200, body: { id: "999", post_id: "12345_777" } };
  });
  const store = memoryStore([job()]);
  const result = await advancePublishJobs({
    jobs: [job()],
    ...baseInput(store, seen.http),
  });
  assert.equal(result[0].status, "published");
  assert.equal(result[0].providerPostId, "12345_777");
  assert.equal(seen.calls.length, 2);
  assert.equal(seen.calls.filter((call) => call.method === "POST").length, 1);
  assertNoSecrets(result);
  assert.equal(JSON.stringify(seen.calls.map((call) => call.path)).includes(PAGE), false);
});

test("facebook permission, task, and provider failures do not publish", async () => {
  const noScope = recorder(async () => {
    throw new Error("graph should not be called");
  });
  const missingPermission = await advancePublishJobs({
    jobs: [job()],
    ...baseInput(memoryStore([job()]), noScope.http, {
      scopes: ["pages_show_list"],
    }),
  });
  assert.equal(missingPermission[0].status, "failed");
  assert.equal(missingPermission[0].safeError, "missing_permission");
  assert.equal(noScope.calls.length, 0);

  const missingTask = recorder(async (call) => {
    assert.equal(call.method, "GET");
    return { ok: true, status: 200, body: { access_token: PAGE, tasks: ["ANALYZE"] } };
  });
  const taskJob = job({ id: "22222222-2222-4222-8222-222222222222" });
  const taskResult = await advancePublishJobs({
    jobs: [taskJob],
    ...baseInput(memoryStore([taskJob]), missingTask.http),
  });
  assert.equal(taskResult[0].safeError, "missing_task");
  assert.equal(missingTask.calls.some((call) => call.method === "POST"), false);

  const invalidImage = recorder(async (call) => {
    if (call.method === "GET") {
      return { ok: true, status: 200, body: { access_token: PAGE, tasks: ["CREATE_CONTENT"] } };
    }
    return { ok: false, status: 400, body: { error: { code: 324 } } };
  });
  const imageJob = job({ id: "33333333-3333-4333-8333-333333333333" });
  const imageResult = await advancePublishJobs({
    jobs: [imageJob],
    ...baseInput(memoryStore([imageJob]), invalidImage.http),
  });
  assert.equal(imageResult[0].safeError, "invalid_image");
  assert.equal(imageResult[0].providerPostId, null);
});

test("facebook timeout and unknown responses are not retried", async () => {
  const timeout = recorder(async (call) => {
    if (call.method === "GET") {
      return { ok: true, status: 200, body: { access_token: PAGE, tasks: ["CREATE_CONTENT"] } };
    }
    return { ok: false, timeout: true };
  });
  const pending = job();
  const store = memoryStore([pending]);
  const first = await advancePublishJobs({
    jobs: [pending],
    ...baseInput(store, timeout.http),
  });
  assert.equal(first[0].status, "unknown");
  assert.equal(first[0].safeError, "ambiguous");
  const callsAfterFirst = timeout.calls.length;
  const second = await advancePublishJobs({
    jobs: [store.jobs.get(pending.id)],
    ...baseInput(store, timeout.http),
  });
  assert.equal(second[0].status, "unknown");
  assert.equal(timeout.calls.length, callsAfterFirst);

  const ambiguous = recorder(async (call) => {
    if (call.method === "GET") {
      return { ok: true, status: 200, body: { access_token: PAGE, tasks: ["CREATE_CONTENT"] } };
    }
    return { ok: true, status: 200, body: { id: "999" } };
  });
  const other = job({ id: "44444444-4444-4444-8444-444444444444" });
  const unknown = await advancePublishJobs({
    jobs: [other],
    ...baseInput(memoryStore([other]), ambiguous.http),
  });
  assert.equal(unknown[0].status, "unknown");
  assert.equal(unknown[0].providerPostId, null);
});

test("expired token fails before any graph call", async () => {
  const http = recorder(async () => {
    throw new Error("graph should not be called");
  });
  const pending = job();
  const result = await advancePublishJobs({
    jobs: [pending],
    ...baseInput(memoryStore([pending]), http.http, {
      tokenExpiresAt: "2000-01-01T00:00:00.000Z",
    }),
  });
  assert.equal(result[0].status, "failed");
  assert.equal(result[0].safeError, "token_expired");
  assert.equal(http.calls.length, 0);
});

test("instagram container is created once and published once", async () => {
  const http = recorder(async (call) => {
    if (call.method === "POST" && call.path.endsWith("/media")) {
      return { ok: true, status: 200, body: { id: "555" } };
    }
    if (call.method === "GET") return { ok: true, status: 200, body: { status_code: "FINISHED" } };
    if (call.path.endsWith("/media_publish")) return { ok: true, status: 200, body: { id: "888" } };
    return { ok: false, status: 500, body: null };
  });
  const pending = job({
    destinationType: "instagram_business",
    providerDestinationId: "67890",
  });
  const store = memoryStore([pending]);
  const result = await advancePublishJobs({
    jobs: [pending],
    ...baseInput(store, http.http),
  });
  assert.equal(result[0].status, "published");
  assert.equal(result[0].providerPostId, "888");
  assert.equal(result[0].providerContainerId, "555");
  assert.equal(http.calls.filter((call) => call.path.endsWith("/media")).length, 1);
  assert.equal(http.calls.filter((call) => call.path.endsWith("/media_publish")).length, 1);
  assertNoSecrets(result);
});

test("instagram in-progress waits for a separate verify and does not publish twice", async () => {
  let statusCode = "IN_PROGRESS";
  const http = recorder(async (call) => {
    if (call.method === "POST" && call.path.endsWith("/media")) {
      return { ok: true, status: 200, body: { id: "555" } };
    }
    if (call.method === "GET") return { ok: true, status: 200, body: { status_code: statusCode } };
    if (call.path.endsWith("/media_publish")) return { ok: true, status: 200, body: { id: "888" } };
    return { ok: false, status: 500, body: null };
  });
  const pending = job({
    id: "55555555-5555-4555-8555-555555555555",
    destinationType: "instagram_business",
    providerDestinationId: "67890",
  });
  const store = memoryStore([pending]);
  const started = await advancePublishJobs({
    jobs: [pending],
    ...baseInput(store, http.http),
  });
  assert.equal(started[0].status, "publishing");
  assert.equal(started[0].providerContainerId, "555");
  assert.equal(http.calls.filter((call) => call.path.endsWith("/media_publish")).length, 0);
  const afterStart = http.calls.length;
  await advancePublishJobs({
    jobs: [store.jobs.get(pending.id)],
    ...baseInput(store, http.http, { mode: "start" }),
  });
  assert.equal(http.calls.length, afterStart);
  statusCode = "FINISHED";
  const verified = await advancePublishJobs({
    jobs: [store.jobs.get(pending.id)],
    ...baseInput(store, http.http, { mode: "verify" }),
  });
  assert.equal(verified[0].status, "published");
  assert.equal(verified[0].providerPostId, "888");
  assert.equal(http.calls.filter((call) => call.path.endsWith("/media")).length, 1);
  assert.equal(http.calls.filter((call) => call.path.endsWith("/media_publish")).length, 1);
});

test("instagram does not publish again when saving the provider result fails", async () => {
  const http = recorder(async (call) => {
    if (call.method === "POST" && call.path.endsWith("/media")) {
      return { ok: true, status: 200, body: { id: "555" } };
    }
    if (call.method === "GET") return { ok: true, status: 200, body: { status_code: "FINISHED" } };
    if (call.path.endsWith("/media_publish")) return { ok: true, status: 200, body: { id: "888" } };
    return { ok: false, status: 500, body: null };
  });
  const pending = job({
    id: "88888888-8888-4888-8888-888888888888",
    destinationType: "instagram_business",
    providerDestinationId: "67890",
  });
  const store = memoryStore([pending]);
  const settle = store.settle;
  store.settle = (id, patch) => (
    patch.status === "published"
      ? Promise.resolve({ outcome: "rejected", job: { ...store.jobs.get(id) } })
      : settle(id, patch)
  );
  const started = await advancePublishJobs({
    jobs: [pending],
    ...baseInput(store, http.http),
  });
  assert.equal(started[0].status, "publishing");
  assert.equal(started[0].safeError, "publish_in_flight");
  assert.equal(started[0].providerPostId, null);
  assert.equal(http.calls.filter((call) => call.path.endsWith("/media_publish")).length, 1);
  const after = http.calls.length;
  const verified = await advancePublishJobs({
    jobs: [store.jobs.get(pending.id)],
    ...baseInput(store, http.http, { mode: "verify" }),
  });
  assert.equal(verified[0].status, "publishing");
  assert.equal(verified[0].safeError, "publish_in_flight");
  assert.equal(http.calls.length, after);
  assert.equal(http.calls.filter((call) => call.method === "POST").length, 2);
  assert.equal(http.calls.filter((call) => call.path.endsWith("/media_publish")).length, 1);
});

test("two verify requests publish one finished instagram container", async () => {
  const http = recorder(async (call) => {
    if (call.method === "GET") return { ok: true, status: 200, body: { status_code: "FINISHED" } };
    if (call.path.endsWith("/media_publish")) return { ok: true, status: 200, body: { id: "888" } };
    return { ok: false, status: 500, body: null };
  });
  const current = job({
    id: "99999999-9999-4999-8999-999999999999",
    destinationType: "instagram_business",
    providerDestinationId: "67890",
    status: "publishing",
    attempts: 1,
    providerContainerId: "555",
  });
  const store = memoryStore([current]);
  const input = baseInput(store, http.http, { mode: "verify" });
  await Promise.all([
    advancePublishJobs({ jobs: [current], ...input }),
    advancePublishJobs({ jobs: [{ ...current }], ...input }),
  ]);
  assert.equal(store.jobs.get(current.id).status, "published");
  assert.equal(store.jobs.get(current.id).providerPostId, "888");
  assert.equal(http.calls.filter((call) => call.path.endsWith("/media")).length, 0);
  assert.equal(http.calls.filter((call) => call.path.endsWith("/media_publish")).length, 1);
});

test("instagram unknown result is not published again", async () => {
  const http = recorder(async (call) => {
    if (call.method === "GET") return { ok: true, status: 200, body: { status_code: "FINISHED" } };
    return { ok: true, status: 200, body: { id: "999" } };
  });
  const unknown = job({
    destinationType: "instagram_business",
    providerDestinationId: "67890",
    status: "unknown",
    attempts: 1,
    providerContainerId: "555",
    safeError: "ambiguous",
  });
  const store = memoryStore([unknown]);
  const result = await advancePublishJobs({
    jobs: [unknown],
    ...baseInput(store, http.http, { mode: "verify" }),
  });
  assert.equal(result[0].status, "unknown");
  assert.equal(result[0].safeError, "ambiguous");
  assert.equal(http.calls.some((call) => call.method === "POST"), false);
  assert.equal(http.calls.length, 0);
});

test("an unconfirmed instagram publish is not sent again", async () => {
  const http = recorder(async () => {
    throw new Error("graph should not be called");
  });
  const locked = job({
    id: "abd75bb4-9cc3-4b8c-a969-bee4189887d8",
    destinationType: "instagram_business",
    providerDestinationId: "67890",
    status: "unknown",
    attempts: 1,
    providerContainerId: "18124570501779553",
    safeError: "awaiting_publish_confirmation",
  });
  const store = memoryStore([locked]);
  const before = { ...store.jobs.get(locked.id) };
  const result = await advancePublishJobs({
    jobs: [locked],
    ...baseInput(store, http.http, { mode: "verify" }),
  });
  assert.equal(result[0].status, "unknown");
  assert.equal(result[0].safeError, "awaiting_publish_confirmation");
  assert.equal(result[0].providerPostId, null);
  assert.deepEqual(store.jobs.get(locked.id), before);
  assert.equal(http.calls.length, 0);
});

test("an in-flight instagram publish is not sent again", async () => {
  const http = recorder(async () => {
    throw new Error("graph should not be called");
  });
  const current = job({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    destinationType: "instagram_business",
    providerDestinationId: "67890",
    status: "publishing",
    attempts: 1,
    providerContainerId: "555",
    safeError: "publish_in_flight",
  });
  const result = await advancePublishJobs({
    jobs: [current],
    ...baseInput(memoryStore([current]), http.http, { mode: "verify" }),
  });
  assert.equal(result[0].status, "publishing");
  assert.equal(result[0].safeError, "publish_in_flight");
  assert.equal(http.calls.length, 0);
});

test("instagram publish timeout stays unknown and is not retried", async () => {
  const http = recorder(async (call) => {
    if (call.method === "GET") return { ok: true, status: 200, body: { status_code: "FINISHED" } };
    return { ok: false, timeout: true };
  });
  const current = job({
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    destinationType: "instagram_business",
    providerDestinationId: "67890",
    status: "publishing",
    attempts: 1,
    providerContainerId: "555",
  });
  const store = memoryStore([current]);
  const first = await advancePublishJobs({
    jobs: [current],
    ...baseInput(store, http.http, { mode: "verify" }),
  });
  assert.equal(first[0].status, "unknown");
  assert.equal(first[0].safeError, "ambiguous");
  assert.equal(first[0].providerPostId, null);
  assert.equal(first[0].providerContainerId, "555");
  const after = http.calls.length;
  const second = await advancePublishJobs({
    jobs: [store.jobs.get(current.id)],
    ...baseInput(store, http.http, { mode: "verify" }),
  });
  assert.equal(second[0].status, "unknown");
  assert.equal(second[0].safeError, "ambiguous");
  assert.equal(http.calls.length, after);
  assert.equal(http.calls.filter((call) => call.path.endsWith("/media_publish")).length, 1);
});

test("instagram publish provider error is saved once", async () => {
  const http = recorder(async (call) => {
    if (call.method === "GET") return { ok: true, status: 200, body: { status_code: "FINISHED" } };
    return { ok: false, status: 400, body: { error: { code: 100 } } };
  });
  const current = job({
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    destinationType: "instagram_business",
    providerDestinationId: "67890",
    status: "publishing",
    attempts: 1,
    providerContainerId: "555",
  });
  const store = memoryStore([current]);
  const failed = await advancePublishJobs({
    jobs: [current],
    ...baseInput(store, http.http, { mode: "verify" }),
  });
  assert.equal(failed[0].status, "failed");
  assert.equal(failed[0].safeError, "provider_error");
  assert.equal(failed[0].providerPostId, null);
  assert.equal(failed[0].providerContainerId, "555");
  const after = http.calls.length;
  const again = await advancePublishJobs({
    jobs: [store.jobs.get(current.id)],
    ...baseInput(store, http.http, { mode: "verify" }),
  });
  assert.equal(again[0].status, "failed");
  assert.equal(http.calls.length, after);
});

test("instagram publish waits when the graph budget is already spent", async () => {
  const http = recorder(async (call) => {
    if (call.method === "GET") return { ok: true, status: 200, body: { status_code: "FINISHED" } };
    if (call.path.endsWith("/media_publish")) {
      return { ok: true, status: 200, body: { id: "18124570501779553" } };
    }
    return { ok: false, status: 500, body: null };
  });
  const current = job({
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    destinationType: "instagram_business",
    providerDestinationId: "67890",
    status: "publishing",
    attempts: 1,
    providerContainerId: "555",
  });
  const store = memoryStore([current]);
  const deferred = await advancePublishJobs({
    jobs: [current],
    ...baseInput(store, http.http, { mode: "verify", budget: createGraphBudget(500) }),
  });
  assert.equal(deferred[0].status, "publishing");
  assert.equal(deferred[0].safeError, null);
  assert.equal(deferred[0].providerPostId, null);
  assert.equal(http.calls.filter((call) => call.path.endsWith("/media_publish")).length, 0);
  const published = await advancePublishJobs({
    jobs: [store.jobs.get(current.id)],
    ...baseInput(store, http.http, { mode: "verify" }),
  });
  assert.equal(published[0].status, "published");
  assert.equal(published[0].providerPostId, "18124570501779553");
  assert.equal(http.calls.filter((call) => call.path.endsWith("/media_publish")).length, 1);
});

test("instagram error, expired, and published statuses do not create another container", async () => {
  for (const [code, status, error] of [
    ["ERROR", "failed", "container_error"],
    ["EXPIRED", "failed", "container_expired"],
    ["PUBLISHED", "unknown", "already_published_unconfirmed"],
  ]) {
    const http = recorder(async () => ({ ok: true, status: 200, body: { status_code: code } }));
    const current = job({
      id: `66666666-6666-4666-8666-${code.toLowerCase().padEnd(12, "0").slice(0, 12)}`,
      destinationType: "instagram_business",
      providerDestinationId: "67890",
      status: "publishing",
      attempts: 1,
      providerContainerId: "555",
    });
    const result = await advancePublishJobs({
      jobs: [current],
      ...baseInput(memoryStore([current]), http.http, { mode: "verify" }),
    });
    assert.equal(result[0].status, status);
    assert.equal(result[0].safeError, error);
    assert.equal(http.calls.some((call) => call.method === "POST"), false);
  }
});

test("facebook success survives an instagram failure", async () => {
  const http = recorder(async (call) => {
    if (call.path === "12345") {
      return { ok: true, status: 200, body: { access_token: PAGE, tasks: ["CREATE_CONTENT"] } };
    }
    if (call.path === "12345/photos") {
      return { ok: true, status: 200, body: { id: "999", post_id: "12345_777" } };
    }
    if (call.path === "67890/media") return { ok: false, status: 400, body: { error: { code: 100 } } };
    return { ok: false, status: 500, body: null };
  });
  const facebook = job();
  const instagram = job({
    id: "77777777-7777-4777-8777-777777777777",
    destinationType: "instagram_business",
    providerDestinationId: "67890",
  });
  const result = await advancePublishJobs({
    jobs: [facebook, instagram],
    ...baseInput(memoryStore([facebook, instagram]), http.http),
  });
  assert.equal(result[0].status, "published");
  assert.equal(result[1].status, "failed");
  assert.equal(http.calls.filter((call) => call.path.endsWith("/media_publish")).length, 0);
});

test("double click and refresh do not create a second facebook post", async () => {
  const http = recorder(async (call) => {
    if (call.method === "GET") {
      return { ok: true, status: 200, body: { access_token: PAGE, tasks: ["CREATE_CONTENT"] } };
    }
    return { ok: true, status: 200, body: { id: "999", post_id: "12345_777" } };
  });
  const pending = job();
  const store = memoryStore([pending]);
  const input = baseInput(store, http.http);
  await Promise.all([
    advancePublishJobs({ jobs: [pending], ...input }),
    advancePublishJobs({ jobs: [{ ...pending }], ...input }),
  ]);
  assert.equal(store.jobs.get(pending.id).status, "published");
  assert.equal(store.jobs.get(pending.id).attempts, 1);
  assert.equal(http.calls.filter((call) => call.method === "POST").length, 1);
  const after = http.calls.length;
  await advancePublishJobs({
    jobs: [store.jobs.get(pending.id)],
    ...input,
  });
  assert.equal(http.calls.length, after);
});

test("live off performs no claim and no graph call", async () => {
  let claimed = false;
  const pending = job();
  const result = await advancePublishJobs({
    jobs: [pending],
    ...baseInput(memoryStore([pending]), async () => {
      throw new Error("graph should not be called");
    }, {
      liveAllowed: false,
      claim: async () => {
        claimed = true;
        return { outcome: "not_found" };
      },
      signImage: async () => {
        throw new Error("image should not be signed");
      },
    }),
  });
  assert.equal(claimed, false);
  assert.equal(result[0].status, "pending");
});

test("an empty graph budget does not call facebook", async () => {
  const http = recorder(async () => {
    throw new Error("graph should not be called");
  });
  const pending = job();
  const result = await advancePublishJobs({
    jobs: [pending],
    ...baseInput(memoryStore([pending]), http.http, { budget: createGraphBudget(0) }),
  });
  assert.equal(result[0].status, "failed");
  assert.equal(result[0].safeError, "timeout");
  assert.equal(http.calls.length, 0);
});

test("publish http client keeps the token in the header", async () => {
  const urls = [];
  const auths = [];
  const http = createMetaPublishHttp(async (url, init) => {
    urls.push(String(url));
    auths.push(init.headers.Authorization);
    if (String(url).includes("/12345/photos")) {
      return new Response(JSON.stringify({ id: "1", post_id: "1_2" }), { status: 200 });
    }
    return new Response(JSON.stringify({ access_token: PAGE, tasks: ["CREATE_CONTENT"] }), { status: 200 });
  });
  const result = await publishFacebookPhoto({
    pageId: "12345",
    userToken: USER,
    scopes: SCOPES,
    imageUrl: IMAGE,
    caption: "Salut",
    appSecret: "app-secret-not-a-token",
    budget: createGraphBudget(),
    http,
  });
  assert.equal(result.providerPostId, "1_2");
  assert.equal(urls.length, 2);
  assert.equal(urls.every((url) => !url.includes(USER) && !url.includes(PAGE)), true);
  assert.deepEqual(auths, [`Bearer ${USER}`, `Bearer ${PAGE}`]);
  assertNoSecrets(result);
});

test("instagram helpers cover the container lifecycle", async () => {
  const created = await createInstagramContainer({
    igUserId: "67890",
    userToken: USER,
    scopes: SCOPES,
    imageUrl: IMAGE,
    caption: "Salut",
    appSecret: "app-secret-not-a-token",
    budget: createGraphBudget(),
    http: async (call) => {
      assert.equal(call.timeoutMs, INSTAGRAM_CONTAINER_TIMEOUT_MS);
      assert.equal(call.token, USER);
      assert.equal(call.form.access_token, undefined);
      return { ok: true, status: 200, body: { id: "555" } };
    },
  });
  assert.equal(created.providerContainerId, "555");
  const status = await readInstagramStatus({
    containerId: "555",
    userToken: USER,
    appSecret: "app-secret-not-a-token",
    budget: createGraphBudget(),
    http: async () => ({ ok: true, status: 200, body: { status_code: "IN_PROGRESS" } }),
  });
  assert.equal(status.kind, "in_progress");
  const published = await publishInstagramContainer({
    igUserId: "67890",
    containerId: "555",
    userToken: USER,
    appSecret: "app-secret-not-a-token",
    budget: createGraphBudget(),
    http: async (call) => {
      assert.equal(call.form.creation_id, "555");
      return { ok: false, timeout: true };
    },
  });
  assert.equal(published.status, "unknown");
  assert.equal(published.safeError, "ambiguous");
  assert.equal(published.providerPostId, null);
  const numeric = await publishInstagramContainer({
    igUserId: "67890",
    containerId: "555",
    userToken: USER,
    appSecret: "app-secret-not-a-token",
    budget: createGraphBudget(),
    http: async () => ({ ok: true, status: 200, body: { id: 888 } }),
  });
  assert.equal(numeric.status, "published");
  assert.equal(numeric.providerPostId, "888");
  const textId = await publishInstagramContainer({
    igUserId: "67890",
    containerId: "555",
    userToken: USER,
    appSecret: "app-secret-not-a-token",
    budget: createGraphBudget(),
    http: async () => ({ ok: true, status: 200, body: { id: "18124570501779553" } }),
  });
  assert.equal(textId.providerPostId, "18124570501779553");
  const unsafe = 18124570501779553;
  assert.equal(Number.isSafeInteger(unsafe), false);
  const rounded = await publishInstagramContainer({
    igUserId: "67890",
    containerId: "555",
    userToken: USER,
    appSecret: "app-secret-not-a-token",
    budget: createGraphBudget(),
    http: async () => ({ ok: true, status: 200, body: { id: unsafe } }),
  });
  assert.equal(rounded.status, "unknown");
  assert.equal(rounded.safeError, "ambiguous");
  assert.equal(rounded.providerPostId, null);
  assert.equal(JSON.stringify(rounded).includes(String(unsafe)), false);
  const unsent = await publishInstagramContainer({
    igUserId: "67890",
    containerId: "555",
    userToken: USER,
    appSecret: "app-secret-not-a-token",
    budget: createGraphBudget(0),
    http: async () => {
      throw new Error("graph should not be called");
    },
  });
  assert.equal(unsent.status, "publishing");
  assert.equal(unsent.safeError, null);
  assert.equal(unsent.providerContainerId, "555");
  assertNoSecrets(published);
});

test("storage validation accepts a real jpeg and rejects the rest", async () => {
  const png = await sharp({
    create: { width: 400, height: 400, channels: 3, background: { r: 20, g: 40, b: 80 } },
  }).png().toBuffer();
  assert.equal(sniffImageMime(png), "image/png");
  const prepared = await prepareMarketingImage(png);
  assert.equal(prepared.ok, true);
  assert.equal(prepared.width, 400);
  assert.equal(sniffImageMime(prepared.jpeg), "image/jpeg");

  const wide = await sharp({
    create: { width: 1000, height: 100, channels: 3, background: { r: 1, g: 2, b: 3 } },
  }).png().toBuffer();
  assert.equal((await prepareMarketingImage(wide)).ok, false);

  const small = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 1, g: 2, b: 3 } },
  }).jpeg().toBuffer();
  assert.equal((await prepareMarketingImage(small)).ok, false);
  assert.equal((await prepareMarketingImage(Buffer.from("not an image"))).reason, "unsupported_type");
  assert.equal((await prepareMarketingImage(Buffer.alloc(0))).reason, "invalid_image");

  const tenant = "5d9862a1-fd85-46f2-9c7e-635e813e067c";
  const path = marketingImagePath(tenant, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(path, `${tenant}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg`);
  assert.equal(marketingImagePath(tenant, "../secret"), null);
  assert.equal(isMetaFetchableImageUrl(IMAGE), true);
  assert.equal(isMetaFetchableImageUrl("http://fanxxytfuhnakfdzwssd.supabase.co/storage/v1/object/sign/marketing-publish/a.jpg"), false);
  assert.equal(isMetaFetchableImageUrl("https://shsompeyazrvswnjmlmw.supabase.co/storage/v1/object/sign/marketing-publish/a.jpg"), false);
  assert.equal(validateCaption("a".repeat(2201)).ok, false);
  assert.equal(validateCaption(`${"#tag ".repeat(31)}`).ok, false);
});

test("public job responses omit secrets", () => {
  const response = publicJobResponse({
    id: "1",
    assetId: "2",
    campaignId: "3",
    destinationId: "4",
    destinationType: "facebook_page",
    displayName: "Frizeo",
    providerDestinationId: "123",
    status: "draft",
    executionMode: "mock",
    attempts: 0,
    providerPostId: null,
    providerContainerId: null,
    safeError: null,
    idempotencyKey: "idempotency-key-123",
    caption: "Salut",
  }, false);
  assert.equal(response.externalCall, false);
  assert.equal(Object.hasOwn(response, "providerDestinationId"), false);
  assert.equal(JSON.stringify(response).includes("access_token"), false);
});

test("instagram lookup matches one post and does not publish", async () => {
  const createdAt = "2026-10-13T07:25:21.000Z";
  const updatedAt = "2026-10-13T07:50:38.000Z";
  const caption = "✂️ Tu te ocupi de tuns. Frizeo se ocupă de programări!";
  const base = {
    caption,
    createdAt,
    updatedAt,
  };
  const hit = matchInstagramPosts({
    ...base,
    posts: [{
      id: "18124570501779554",
      caption: "✂️ Tu te ocupi de tuns.  Frizeo se ocupă de programări!",
      timestamp: "2026-10-13T07:51:00.000Z",
      mediaType: "IMAGE",
      imageDistance: null,
    }],
  });
  assert.equal(hit.found, true);
  if (hit.found) assert.equal(hit.providerPostId, "18124570501779554");

  const late = matchInstagramPosts({
    ...base,
    posts: [{
      id: "18124570501779555",
      caption,
      timestamp: "2026-10-13T12:00:00.000Z",
      mediaType: "IMAGE",
      imageDistance: null,
    }],
  });
  assert.deepEqual(late, { found: false, reason: "none" });
  assert.equal(JSON.stringify(late).includes("failed"), false);
  assert.equal(INSTAGRAM_NOT_FOUND, "Nu a fost găsită");

  const differentImage = matchInstagramPosts({
    ...base,
    posts: [{
      id: "18124570501779556",
      caption,
      timestamp: "2026-10-13T07:51:00.000Z",
      mediaType: "IMAGE",
      imageDistance: 24,
    }],
  });
  assert.equal(differentImage.found, false);

  const imageOnly = matchInstagramPosts({
    ...base,
    posts: [{
      id: "18124570501779557",
      caption: "alt text",
      timestamp: "2026-10-13T07:40:00.000Z",
      mediaType: "IMAGE",
      imageDistance: 4,
    }],
  });
  assert.equal(imageOnly.found, true);

  const several = matchInstagramPosts({
    ...base,
    posts: [
      { id: "18124570501779558", caption, timestamp: "2026-10-13T07:40:00.000Z", mediaType: "IMAGE", imageDistance: null },
      { id: "18124570501779559", caption, timestamp: "2026-10-13T07:42:00.000Z", mediaType: "IMAGE", imageDistance: null },
    ],
  });
  assert.deepEqual(several, { found: false, reason: "several" });

  const video = matchInstagramPosts({
    ...base,
    posts: [{
      id: "18124570501779560",
      caption,
      timestamp: "2026-10-13T07:40:00.000Z",
      mediaType: "VIDEO",
      imageDistance: null,
    }],
  });
  assert.equal(video.found, false);

  const block = await sharp({
    create: { width: 180, height: 320, channels: 3, background: { r: 250, g: 250, b: 250 } },
  }).png().toBuffer();
  const red = await sharp({
    create: { width: 640, height: 800, channels: 3, background: { r: 180, g: 30, b: 40 } },
  }).composite([{ input: block, left: 40, top: 40 }]).jpeg({ quality: 90 }).toBuffer();
  const redAgain = await sharp(red).jpeg({ quality: 40 }).toBuffer();
  const blue = await sharp({
    create: { width: 640, height: 800, channels: 3, background: { r: 20, g: 40, b: 180 } },
  }).composite([{ input: block, left: 400, top: 420 }]).jpeg().toBuffer();
  const redHash = await averageHash(red);
  const redAgainHash = await averageHash(redAgain);
  const blueHash = await averageHash(blue);
  assert.ok(redHash != null && redAgainHash != null && blueHash != null);
  assert.ok(hashDistance(redHash, redAgainHash) <= 10);
  assert.ok(hashDistance(redHash, blueHash) >= 18);

  const calls = [];
  const http = async (call) => {
    calls.push(call);
    assert.equal(call.method, "GET");
    assert.equal(call.path, "17841400000000000/media");
    assert.equal(call.path.includes("media_publish"), false);
    return {
      ok: true,
      status: 200,
      body: {
        data: [{
          id: "18124570501779554",
          caption,
          timestamp: "2026-10-13T07:51:00.000Z",
          media_type: "IMAGE",
          media_url: "https://scontent.cdninstagram.com/v/post.jpg",
        }],
      },
    };
  };
  const listed = await listInstagramMedia({
    igUserId: "17841400000000000",
    userToken: USER,
    scopes: SCOPES,
    appSecret: "app-secret",
    budget: createGraphBudget(),
    http,
  });
  assert.equal(listed.kind, "ok");
  assert.equal(calls.length, 1);
  assert.equal(JSON.stringify(listed).includes(USER), false);

  let imageFetches = 0;
  const ranked = await rankInstagramPosts({
    caption,
    createdAt,
    updatedAt,
    localImage: red,
    posts: listed.kind === "ok" ? listed.posts : [],
    fetchImage: async (url) => {
      imageFetches += 1;
      assert.equal(isInstagramCdnUrl(url), true);
      return redAgain;
    },
  });
  assert.equal(imageFetches, 1);
  assert.equal(ranked.found, true);

  const outside = await rankInstagramPosts({
    caption,
    createdAt,
    updatedAt,
    localImage: red,
    posts: [{
      id: "18124570501779561",
      caption,
      timestamp: "2026-10-18T07:51:00.000Z",
      mediaType: "IMAGE",
      mediaUrl: "https://scontent.cdninstagram.com/v/later.jpg",
    }],
    fetchImage: async () => {
      throw new Error("image outside the window");
    },
  });
  assert.deepEqual(outside, { found: false, reason: "none" });

  const missingScope = await listInstagramMedia({
    igUserId: "17841400000000000",
    userToken: USER,
    scopes: [],
    appSecret: "app-secret",
    budget: createGraphBudget(),
    http: async () => {
      throw new Error("graph");
    },
  });
  assert.equal(missingScope.kind, "missing_permission");

  const unsafe = await listInstagramMedia({
    igUserId: "17841400000000000",
    userToken: USER,
    scopes: SCOPES,
    appSecret: "app-secret",
    budget: createGraphBudget(),
    http: async () => ({ ok: true, status: 200, body: { data: [{ id: 18124570501779553 }] } }),
  });
  assert.equal(unsafe.kind, "unknown");
  assert.equal(isInstagramCdnUrl("https://evil.example/image.jpg"), false);
  assert.equal(isInstagramCdnUrl("http://scontent.cdninstagram.com/a.jpg"), false);
});

test("publish migration and routes stay fail closed", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/20261011092649_frizeo_v2_meta_publish.sql"),
    "utf8",
  );
  assert.match(migration, /marketing\.publish\.meta\.live/);
  assert.match(migration, /'unknown'/);
  assert.match(migration, /integration_publish_jobs_idempotency_uidx/);
  assert.match(migration, /provider_container_id/);
  assert.match(migration, /'marketing-publish'/);
  assert.match(migration, /false/);
  assert.match(migration, /8388608/);
  assert.match(migration, /on conflict \(id\) do nothing/);
  assert.match(migration, /grant execute on function public\.meta_publish_prepare/);
  assert.match(migration, /revoke all on function public\.meta_publish_prepare/);
  assert.match(migration, /from public, anon, authenticated/);
  assert.doesNotMatch(migration, /insert into public\.tenant_capabilities/i);
  assert.doesNotMatch(migration, /salon-logos/);
  assert.doesNotMatch(migration, /enable row level security/);

  const routeDir = join(root, "app/api/integrations/meta/publish");
  for (const entry of readdirSync(routeDir)) {
    const source = readFileSync(join(routeDir, entry, "route.ts"), "utf8");
    assert.match(source, /export const maxDuration = 10/);
    assert.doesNotMatch(source, /export (async )?function GET/);
    assert.doesNotMatch(source, /graph\.facebook\.com/);
  }

  const handlers = readFileSync(join(root, "lib/integrations/meta/publish/handlers.ts"), "utf8");
  const liveStart = handlers.indexOf("export async function publishLive");
  const verifyStart = handlers.indexOf("export async function verifyPublish");
  const liveBody = handlers.slice(liveStart, verifyStart);
  assert.ok(liveBody.indexOf("liveCapabilityEnabled") < liveBody.indexOf("readMetaAccessToken"));
  assert.ok(liveBody.indexOf("preparePublishJobs") < liveBody.indexOf("readMetaAccessToken"));
  assert.ok(liveBody.indexOf("readMetaAccessToken") < liveBody.indexOf("createMetaPublishHttp"));
  const store = readFileSync(join(root, "lib/integrations/meta/publish/store.ts"), "utf8");
  assert.match(store, /destination_busy/);

  const guard = readFileSync(
    join(root, "supabase/migrations/20261011104534_frizeo_v2_meta_publish_destination_busy.sql"),
    "utf8",
  );
  const replayAt = guard.indexOf("'replay'");
  const busyAt = guard.indexOf("'destination_busy'");
  const insertAt = guard.lastIndexOf("insert into public.integration_publish_jobs");
  assert.ok(replayAt > 0 && busyAt > replayAt && insertAt > busyAt);
  assert.match(guard, /integration_publish_jobs_live_open_destination_uidx/);
  assert.match(guard, /status in \('pending', 'publishing', 'unknown'\)/);
  assert.match(guard, /:publish-destination:/);
  assert.doesNotMatch(guard, /insert into public\.tenant_capabilities/i);
  assert.doesNotMatch(handlers, /console\.log/);
  const page = readFileSync(join(root, "app/admin/marketing/publish/page.tsx"), "utf8");
  assert.match(page, /canAdministerIntegrations/);
  assert.match(page, /redirect\("\/admin\/dashboard"\)/);
  assert.match(page, /isProduction\(\)/);
  assert.match(page, /provider_container_id/);
  const composer = readFileSync(join(root, "app/admin/marketing/publish/PublishComposer.tsx"), "utf8");
  assert.match(composer, /disabled=\{!liveAvailable/);
  assert.match(composer, /destinationBusy/);
  assert.match(composer, /Deblochează pentru o încercare nouă/);
  assert.match(composer, /container Instagram anterior/);
  assert.match(composer, /publish_in_flight/);
  assert.match(composer, /awaiting_publish_confirmation/);
  assert.match(composer, /safeError !== "publish_in_flight"/);
  assert.match(composer, /Verifică statusul/);
  assert.match(composer, /Verifică pe Instagram/);
  assert.match(composer, /INSTAGRAM_NOT_FOUND/);
  assert.match(composer, /Confirmă reconcilierea/);
  assert.match(composer, /destinationType === "instagram_business"/);
  assert.match(composer, /\/api\/integrations\/meta\/publish\/lookup/);
  assert.match(composer, /\/api\/integrations\/meta\/publish\/reconcile/);
  assert.ok(composer.indexOf("Confirmi reconcilierea?") < composer.indexOf("/api/integrations/meta/publish/reconcile"));
  const lookupStart = handlers.indexOf("export async function lookupInstagramPublish");
  const reconcileStart = handlers.indexOf("export async function reconcileInstagramPublish");
  const cleanupStart = handlers.indexOf("export async function cleanupPublishMedia");
  const lookupBody = handlers.slice(lookupStart, reconcileStart);
  const reconcileBody = handlers.slice(reconcileStart, cleanupStart);
  assert.ok(lookupStart > 0 && reconcileStart > lookupStart);
  assert.doesNotMatch(lookupBody, /settlePublishJob/);
  assert.doesNotMatch(lookupBody, /media_publish/);
  assert.match(reconcileBody, /settlePublishJob/);
  assert.match(reconcileBody, /status: "published"/);
  assert.doesNotMatch(reconcileBody, /media_publish/);
  assert.match(handlers, /call\.method !== "GET"/);
  assert.match(composer, /\/api\/integrations\/meta\/publish\/verify/);
  assert.match(composer, /window\.confirm\(VERIFY_CONFIRM\)/);
  assert.ok(composer.indexOf("window.confirm(VERIFY_CONFIRM)") < composer.indexOf("/api/integrations/meta/publish/verify"));
  const releaseMigration = readFileSync(
    join(root, "supabase/migrations/20261011143000_frizeo_v2_meta_publish_release_ambiguous.sql"),
    "utf8",
  );
  assert.match(releaseMigration, /status = 'released'/);
  assert.match(releaseMigration, /safe_error = 'ambiguous'/);
  assert.match(releaseMigration, /grant execute on function public\.meta_publish_release_ambiguous/);
  assert.doesNotMatch(releaseMigration, /status = 'failed'/);
  assert.doesNotMatch(releaseMigration, /insert into public\.tenant_capabilities/i);
  const claimFinished = readFileSync(
    join(root, "supabase/migrations/20261018065000_frizeo_v2_meta_publish_claim_finished.sql"),
    "utf8",
  );
  assert.match(claimFinished, /safe_error = 'publish_in_flight'/);
  assert.match(claimFinished, /status = 'publishing'/);
  assert.match(claimFinished, /for update/);
  assert.match(claimFinished, /grant execute on function public\.meta_publish_claim_finished/);
  assert.match(claimFinished, /revoke all on function public\.meta_publish_claim_finished\(uuid, uuid, text\) from public, anon, authenticated/);
  assert.doesNotMatch(claimFinished, /media_publish/);
  assert.doesNotMatch(claimFinished, /status = 'unknown'/);
  assert.doesNotMatch(claimFinished, /insert into public\.tenant_capabilities/i);
  const releaseStart = handlers.indexOf("export async function releaseAmbiguousPublish");
  const releaseBody = handlers.slice(releaseStart, handlers.indexOf("async function readConnection"));
  assert.ok(releaseStart > 0);
  assert.doesNotMatch(releaseBody, /readMetaAccessToken/);
  assert.doesNotMatch(releaseBody, /createMetaPublishHttp/);
  assert.doesNotMatch(releaseBody, /graph\.facebook\.com/);
  assert.match(composer, /if \(!payload\.jobs\.some\(openLive\)\) keyRef\.current = null/);
  assert.match(composer, /Publicarea reală este oprită/);
  assert.match(composer, /Rulează testul mock/);
  const example = readFileSync(join(root, ".env.example"), "utf8");
  assert.match(example, /# META_PUBLISH_LIVE=/);
  assert.doesNotMatch(example, /META_PUBLISH_LIVE=true/);
  for (const file of readdirSync(join(root, "lib/integrations/meta/publish"))) {
    const source = readFileSync(join(root, "lib/integrations/meta/publish", file), "utf8");
    assert.doesNotMatch(source, /console\.log/);
  }
});
