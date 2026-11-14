import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { encryptIntegrationSecret, decryptIntegrationSecret } from "../lib/integrations/crypto.ts";
import {
  assertGoogleBusinessConfig,
  GOOGLE_BUSINESS_SCOPE,
  isGooglePostId,
  isMetaPostId,
} from "../lib/integrations/google-business/config.ts";
import {
  buildGoogleAuthorizeUrl,
  decideGoogleConnect,
  encodeGoogleToken,
  parseGoogleAccounts,
  parseGoogleLocations,
  parseGoogleToken,
  planGoogleDestinationSave,
  presentGooglePublishJob,
  publicGoogleConnection,
  readGoogleToken,
} from "../lib/integrations/google-business/flow.ts";
import { listGoogleAccounts } from "../lib/integrations/google-business/api.ts";
import { buildGoogleLocalPost, publishLocalPost } from "../lib/integrations/google-business/publish.ts";
import { getProviderAdapter } from "../lib/integrations/providers/registry.ts";
import { writeMarketingPublishHandoff, takeMarketingPublishHandoff } from "../lib/marketing-ai/publishHandoff.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const key = Buffer.alloc(32, 9).toString("base64");

test("google connect stays closed without capability and for staff", () => {
  assert.deepEqual(decideGoogleConnect({
    authenticated: true,
    role: "owner",
    capabilityEnabled: false,
    configured: true,
    production: false,
  }), { ok: false, reason: "capability_off" });
  assert.deepEqual(decideGoogleConnect({
    authenticated: true,
    role: "staff",
    capabilityEnabled: true,
    configured: true,
    production: false,
  }), { ok: false, reason: "forbidden" });
  assert.deepEqual(decideGoogleConnect({
    authenticated: true,
    role: "manager",
    capabilityEnabled: true,
    configured: true,
    production: false,
  }), { ok: true });
});

test("google oauth is separate from calendar and requests only business.manage", () => {
  const shared = assertGoogleBusinessConfig({
    GOOGLE_BUSINESS_CLIENT_ID: "calendar-client",
    GOOGLE_BUSINESS_CLIENT_SECRET: "secret",
    GOOGLE_CLIENT_ID: "calendar-client",
    INTEGRATION_TOKEN_ENCRYPTION_KEY: key,
  }, { production: false });
  assert.equal(shared.ok, false);

  const ready = assertGoogleBusinessConfig({
    GOOGLE_BUSINESS_CLIENT_ID: "business-client",
    GOOGLE_BUSINESS_CLIENT_SECRET: "secret",
    GOOGLE_CLIENT_ID: "calendar-client",
    INTEGRATION_TOKEN_ENCRYPTION_KEY: key,
  }, { production: false });
  assert.equal(ready.ok, true);
  if (!ready.ok) return;
  const url = new URL(buildGoogleAuthorizeUrl({
    config: ready.config,
    state: "state-1",
    codeChallenge: "challenge-1",
  }));
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("scope"), GOOGLE_BUSINESS_SCOPE);
  assert.equal(url.searchParams.get("include_granted_scopes"), "false");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.getAll("scope").length, 1);
  assert.equal(url.toString().includes("calendar"), false);
});

test("google token storage stays encrypted and out of the public connection", () => {
  const previous = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = key;
  try {
    const serialized = encodeGoogleToken({
      accessToken: "ya29-access",
      refreshToken: "1//refresh",
      obtainedAt: "2026-11-11T00:00:00.000Z",
    });
    const encrypted = encryptIntegrationSecret(serialized);
    assert.equal("ciphertext" in encrypted, true);
    if (!("ciphertext" in encrypted)) return;
    const plaintext = decryptIntegrationSecret(encrypted);
    assert.equal(plaintext, serialized);
    assert.deepEqual(readGoogleToken(String(plaintext)), {
      accessToken: "ya29-access",
      refreshToken: "1//refresh",
    });
    const view = publicGoogleConnection({
      displayName: "Cont test",
      status: "setup_required",
      scopes: [GOOGLE_BUSINESS_SCOPE, "https://www.googleapis.com/auth/calendar"],
    });
    assert.equal(JSON.stringify(view).includes("ya29-access"), false);
    assert.deepEqual(view.scopes, [GOOGLE_BUSINESS_SCOPE]);
  } finally {
    if (previous === undefined) delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
    else process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = previous;
  }
});

test("google token response rejects calendar and any scope other than business.manage", () => {
  assert.equal(parseGoogleToken({
    access_token: "a",
    refresh_token: "r",
    expires_in: 3600,
    scope: "https://www.googleapis.com/auth/calendar",
  }).ok, false);
  assert.equal(parseGoogleToken({
    access_token: "a",
    refresh_token: "r",
    expires_in: 3600,
    scope: `${GOOGLE_BUSINESS_SCOPE} openid`,
  }).ok, false);
  const parsed = parseGoogleToken({
    access_token: "a",
    refresh_token: "r",
    expires_in: 3600,
    scope: GOOGLE_BUSINESS_SCOPE,
  });
  assert.equal(parsed.ok, true);
});

test("location selection stays inside the locations returned for that salon", () => {
  assert.deepEqual(parseGoogleAccounts({}), []);
  assert.deepEqual(parseGoogleLocations({ locations: [{ name: "locations/nope", title: "X" }] }, "not-an-account"), []);
  const discovered = parseGoogleLocations({
    locations: [{ name: "locations/222", title: "Locație de test" }],
  }, "accounts/111");
  assert.equal(discovered.length, 1);
  const otherSalon = "accounts/999/locations/888";
  assert.deepEqual(planGoogleDestinationSave({
    tenantId: "tenant-a",
    discovered,
    selectedIds: [otherSalon],
  }), { ok: false, reason: "unknown_destination" });
  const saved = planGoogleDestinationSave({
    tenantId: "tenant-a",
    discovered,
    selectedIds: [discovered[0].id],
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.deepEqual(saved.rows.map((row) => row.provider_destination_id), ["accounts/111/locations/222"]);
});

test("google mock post keeps a 1500 character summary and a public book link", () => {
  const bookingUrl = "https://frizeo.ro/booking/demo-barber-salon";
  const tooLong = buildGoogleLocalPost({ summary: "a".repeat(1501), bookingUrl });
  assert.deepEqual(tooLong, { ok: false, reason: "summary" });
  const staging = buildGoogleLocalPost({
    summary: "Programare",
    bookingUrl: "https://staging.frizeo.ro/booking/demo-barber-salon",
  });
  assert.deepEqual(staging, { ok: false, reason: "booking_link" });
  const ready = buildGoogleLocalPost({
    summary: "**Programare** disponibilă",
    bookingUrl,
    imageUrl: "https://cdn.example.com/card.jpg",
  });
  assert.equal(ready.ok, true);
  if (!ready.ok) return;
  assert.equal(ready.body.summary.length <= 1500, true);
  assert.equal(ready.body.summary.includes("**"), false);
  assert.deepEqual(ready.body.callToAction, { actionType: "BOOK", url: bookingUrl });
  assert.equal(ready.body.media?.[0].mediaFormat, "PHOTO");
});

test("google mock without a booking link omits Rezervă and markdown", () => {
  const plain = buildGoogleLocalPost({
    summary: "**Program** de vineri",
    bookingUrl: null,
  });
  assert.equal(plain.ok, true);
  if (!plain.ok) return;
  assert.equal(plain.body.summary, "Program de vineri");
  assert.equal(plain.body.summary.includes("**"), false);
  assert.equal(Object.hasOwn(plain.body, "callToAction"), false);
  const blank = buildGoogleLocalPost({ summary: "Program", bookingUrl: "   " });
  assert.equal(blank.ok, true);
  if (!blank.ok) return;
  assert.equal(Object.hasOwn(blank.body, "callToAction"), false);
  assert.equal(buildGoogleLocalPost({ summary: "****", bookingUrl: null }).ok, false);
  const migration = readFileSync(
    join(root, "supabase/migrations/20261114051851_frizeo_v2_google_mock_without_booking.sql"),
    "utf8",
  );
  assert.match(migration, /replace\(coalesce\(p_caption, ''\), '\*\*', ''\)/);
  assert.match(migration, /when v_booking = '' then '\{\}'::jsonb/);
  assert.match(migration, /'mock'/);
  assert.equal(migration.includes("'live'"), false);
  assert.equal(migration.includes("mybusiness.googleapis.com"), false);
  assert.equal(migration.includes("graph.facebook.com"), false);
  assert.equal(migration.includes("open.tiktokapis.com"), false);
  const composer = readFileSync(join(root, "app/admin/marketing/publish/PublishComposer.tsx"), "utf8");
  const mockStart = composer.indexOf("async function runMock");
  const mockBody = composer.slice(mockStart, composer.indexOf("async function cleanup"));
  assert.equal(mockBody.includes("ERRORS.booking_link_missing"), false);
  assert.match(mockBody, /bookingUrl: bookingUrl \?\? ""/);
  assert.match(mockBody, /fără butonul Rezervă/);
  assert.match(composer, /Nu se face niciun apel către Google, Meta sau TikTok/);
});

test("prepared live adapter accepts a text post id and does not invent one", async () => {
  const post = buildGoogleLocalPost({
    summary: "Programare",
    bookingUrl: "https://www.frizeo.ro/booking/demo",
  });
  assert.equal(post.ok, true);
  if (!post.ok) return;
  let called = 0;
  const published = await publishLocalPost({
    accessToken: "token-not-logged",
    locationId: "accounts/111/locations/222",
    post: post.body,
    http: async () => {
      called += 1;
      return {
        status: 200,
        body: { name: "accounts/111/locations/222/localPosts/AbC_123" },
      };
    },
  });
  assert.equal(called, 1);
  assert.equal(published.ok, true);
  if (!published.ok) return;
  assert.equal(published.providerPostId, "accounts/111/locations/222/localPosts/AbC_123");
  assert.equal(isGooglePostId(published.providerPostId), true);
  const missing = await publishLocalPost({
    accessToken: "token-not-logged",
    locationId: "accounts/111/locations/222",
    post: post.body,
    http: async () => ({ status: 200, body: {} }),
  });
  assert.deepEqual(missing, { ok: false, reason: "unconfirmed", externalCall: true });
});

test("google job ids stay text and meta numeric ids still match", () => {
  assert.equal(isMetaPostId("1143650465505273_122142275817390654"), true);
  assert.equal(isGooglePostId("1143650465505273_122142275817390654"), false);
  assert.equal(isGooglePostId("accounts/111/locations/222/localPosts/AbC_123"), true);
  assert.equal(isMetaPostId("accounts/111/locations/222/localPosts/AbC_123"), false);
  assert.equal(presentGooglePublishJob({
    id: "job-1",
    asset_id: "asset-1",
    destination_id: "dest-1",
    destination_type: "facebook_page",
    execution_mode: "mock",
    status: "draft",
    provider_post_id: "123",
  }), null);
  const view = presentGooglePublishJob({
    id: "job-1",
    asset_id: "asset-1",
    destination_id: "dest-1",
    destination_type: "google_business_location",
    display_name: "Locație de test",
    execution_mode: "mock",
    status: "draft",
    provider_post_id: null,
    caption: "Programare",
  });
  assert.equal(view?.destinationType, "google_business_location");
  assert.equal(view?.providerPostId, null);
  assert.equal(view?.executionMode, "mock");
});

test("google live route cannot call Google and the lab adapter stays closed", async () => {
  const live = readFileSync(join(root, "lib/integrations/google-business/handlers.ts"), "utf8");
  const liveFn = live.slice(live.indexOf("export async function publishGoogleLive"));
  assert.match(liveFn, /live_off/);
  assert.equal(liveFn.includes("publishLocalPost"), false);
  assert.equal(liveFn.includes("mybusiness.googleapis.com"), false);
  const mockFn = live.slice(live.indexOf("export async function publishGoogleMock"), live.indexOf("export async function publishGoogleLive"));
  assert.match(mockFn, /google_business_publish_prepare/);
  assert.match(mockFn, /externalCall: false/);
  assert.equal(mockFn.includes("mybusiness.googleapis.com"), false);
  assert.deepEqual(await getProviderAdapter("google_business").publish(), {
    implemented: false,
    reason: "not_implemented",
  });
  const meta = readFileSync(join(root, "lib/integrations/meta/publish/facebook.ts"), "utf8");
  assert.equal(meta.includes("google_business"), false);
});

test("marketing handoff keeps only a public booking link for the Google button", () => {
  const storage = {
    value: null,
    getItem() { return this.value; },
    setItem(_key, value) { this.value = value; },
    removeItem() { this.value = null; },
  };
  assert.equal(writeMarketingPublishHandoff(storage, {
    caption: "Programare",
    bytes: Uint8Array.from([1]),
    mimeType: "image/jpeg",
    bookingUrl: "https://staging.frizeo.ro/booking/demo",
  }), true);
  assert.equal(takeMarketingPublishHandoff(storage)?.bookingUrl, undefined);
  assert.equal(writeMarketingPublishHandoff(storage, {
    caption: "Programare",
    bytes: Uint8Array.from([1]),
    mimeType: "image/jpeg",
    bookingUrl: "https://frizeo.ro/booking/demo-barber-salon",
  }), true);
  assert.equal(takeMarketingPublishHandoff(storage)?.bookingUrl, "https://frizeo.ro/booking/demo-barber-salon");
});

async function captureAccounts(http) {
  const lines = [];
  const original = console.error;
  console.error = (...args) => {
    lines.push(args.map((part) => String(part)).join(" "));
  };
  try {
    const result = await listGoogleAccounts({
      accessToken: "ya29.super-secret-token",
      http,
    });
    return { result, log: lines.join("\n") };
  } finally {
    console.error = original;
  }
}

test("google account list keeps a real 200 empty list separate from API errors", async () => {
  const found = await captureAccounts(async () => ({
    status: 200,
    body: { accounts: [{ name: "accounts/123", accountName: "Frizeo" }] },
  }));
  assert.equal(found.result.ok, true);
  if (found.result.ok) {
    assert.deepEqual(found.result.accounts, [{ name: "accounts/123", accountName: "Frizeo" }]);
  }
  assert.equal(found.log, "");

  const empty = await captureAccounts(async () => ({ status: 200, body: { accounts: [] } }));
  assert.deepEqual(empty.result, { ok: true, accounts: [] });
  assert.equal(empty.log, "");

  const unrecognized = await captureAccounts(async () => ({ status: 200, body: { accounts: [{ name: "not-an-account" }] } }));
  assert.equal(unrecognized.result.ok, false);
  if (!unrecognized.result.ok) assert.equal(unrecognized.result.reason, "unavailable");
});

test("google account list reports 403, disabled API, and unapproved access without secrets", async () => {
  const forbidden = await captureAccounts(async () => ({
    status: 403,
    body: {
      error: {
        code: 403,
        status: "PERMISSION_DENIED",
        message: "The caller does not have permission",
      },
    },
  }));
  assert.equal(forbidden.result.ok, false);
  if (!forbidden.result.ok) {
    assert.equal(forbidden.result.reason, "forbidden");
    assert.equal(forbidden.result.httpStatus, 403);
    assert.equal(forbidden.result.googleCode, 403);
    assert.equal(forbidden.result.googleMessage, "The caller does not have permission");
  }
  assert.match(forbidden.log, /"httpStatus":403/);
  assert.match(forbidden.log, /PERMISSION_DENIED/);
  assert.equal(forbidden.log.includes("ya29.super-secret-token"), false);

  const disabled = await captureAccounts(async () => ({
    status: 403,
    body: {
      error: {
        code: 403,
        status: "PERMISSION_DENIED",
        message: "API disabled for owner@frizeo.ro token ya29.super-secret-token https://console.developers.google.com/apis/api/x?key=secret",
        details: [{ reason: "SERVICE_DISABLED", metadata: { quota_limit_value: "0" } }],
      },
    },
  }));
  assert.equal(disabled.result.ok, false);
  if (!disabled.result.ok) {
    assert.equal(disabled.result.reason, "api_disabled");
    assert.equal(disabled.result.googleReason, "SERVICE_DISABLED");
    assert.equal(disabled.result.googleMessage.includes("owner@frizeo.ro"), false);
    assert.equal(disabled.result.googleMessage.includes("ya29"), false);
    assert.equal(disabled.result.googleMessage.includes("http"), false);
  }
  assert.equal(disabled.log.includes("owner@frizeo.ro"), false);
  assert.equal(disabled.log.includes("ya29"), false);
  assert.equal(disabled.log.includes("key=secret"), false);

  const unapproved = await captureAccounts(async () => ({
    status: 403,
    body: {
      error: {
        code: 403,
        status: "PERMISSION_DENIED",
        message: "Quota exceeded",
        details: [{ reason: "RATE_LIMIT_EXCEEDED", metadata: { quota_limit_value: "0" } }],
      },
    },
  }));
  assert.equal(unapproved.result.ok, false);
  if (!unapproved.result.ok) assert.equal(unapproved.result.reason, "access_not_approved");
});

test("google account list reports 429 and network failures without turning them into an empty list", async () => {
  const limited = await captureAccounts(async () => ({
    status: 429,
    body: {
      error: {
        code: 429,
        status: "RESOURCE_EXHAUSTED",
        message: "Quota exceeded for quota metric Requests",
      },
    },
  }));
  assert.equal(limited.result.ok, false);
  if (!limited.result.ok) {
    assert.equal(limited.result.reason, "rate_limited");
    assert.equal(limited.result.httpStatus, 429);
    assert.equal(limited.result.googleCode, 429);
  }
  assert.match(limited.log, /"httpStatus":429/);
  assert.match(limited.log, /Quota exceeded for quota metric Requests/);
  assert.equal(limited.log.includes("ya29.super-secret-token"), false);

  const quotaZero = await captureAccounts(async () => ({
    status: 429,
    body: {
      error: {
        code: 429,
        status: "RESOURCE_EXHAUSTED",
        message: "Quota exceeded",
        details: [{ reason: "RATE_LIMIT_EXCEEDED", metadata: { quota_limit_value: "0" } }],
      },
    },
  }));
  assert.equal(quotaZero.result.ok, false);
  if (!quotaZero.result.ok) assert.equal(quotaZero.result.reason, "access_not_approved");

  const network = await captureAccounts(async () => {
    throw new Error("connect ECONNRESET ya29.super-secret-token owner@frizeo.ro");
  });
  assert.equal(network.result.ok, false);
  if (!network.result.ok) {
    assert.equal(network.result.reason, "network");
    assert.equal(network.result.httpStatus, null);
    assert.equal(network.result.googleMessage, null);
  }
  assert.equal(network.log.includes("ya29"), false);
  assert.equal(network.log.includes("ECONNRESET"), false);
  assert.equal(network.log.includes("owner@frizeo.ro"), false);
  assert.equal(Array.isArray(network.result.accounts), false);
});
