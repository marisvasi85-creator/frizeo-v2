import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { assertOAuthCallback, createOAuthState } from "../lib/integrations/oauth/state.ts";
import { runMetaCallback } from "../lib/integrations/meta/callback.ts";
import {
  META_APP_ID,
  META_LOGIN_CONFIGURATION_ID,
  META_OAUTH_REDIRECT_URI,
  assertMetaConfig,
} from "../lib/integrations/meta/config.ts";
import {
  buildMetaAuthorizeUrl,
  containsSecretMaterial,
  decideMetaConnect,
  effectiveMetaStatus,
  isBrowserSafeMetaRedirect,
  metaCallbackError,
  missingRequiredScopes,
  parseDebugToken,
  parseMetaPages,
  planCallbackPersistence,
  planDisconnect,
  planMetaDestinationSave,
  planMetaUpsert,
  presentMetaDestination,
  stagingSettingsUrl,
} from "../lib/integrations/meta/flow.ts";
import { createMockPublishJob } from "../lib/integrations/publish/mockJob.ts";

const root = dirname(fileURLToPath(import.meta.url));
const parent = dirname(root);
const encryptionKey = Buffer.alloc(32, 11).toString("base64");
const readyEnv = {
  META_APP_ID,
  META_APP_SECRET: "server-side-secret-not-for-the-browser",
  META_LOGIN_CONFIGURATION_ID,
  META_OAUTH_REDIRECT_URI,
  INTEGRATION_TOKEN_ENCRYPTION_KEY: encryptionKey,
};
const config = {
  appId: META_APP_ID,
  appSecret: readyEnv.META_APP_SECRET,
  configurationId: META_LOGIN_CONFIGURATION_ID,
  redirectUri: META_OAUTH_REDIRECT_URI,
};

function gate(overrides = {}) {
  return decideMetaConnect({
    authenticated: true,
    role: "owner",
    capabilityEnabled: true,
    configured: true,
    production: false,
    ...overrides,
  });
}

test("owner and manager can start Meta connect; barber, anonymous, and flag off cannot", () => {
  assert.equal(gate({ role: "owner" }).ok, true);
  assert.equal(gate({ role: "manager" }).ok, true);
  assert.deepEqual(gate({ role: "barber" }), { ok: false, reason: "forbidden" });
  assert.deepEqual(gate({ authenticated: false, role: null }), { ok: false, reason: "unauthenticated" });
  assert.deepEqual(gate({ capabilityEnabled: false }), { ok: false, reason: "capability_off" });
  assert.deepEqual(gate({ production: true }), { ok: false, reason: "production" });
  assert.equal(assertMetaConfig({}, { production: false }).ok, false);
});

test("authorize URL is Facebook Login for Business and carries no secret", () => {
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = encryptionKey;
  const issued = createOAuthState({
    tenantId: "tenant-a",
    userId: "user-a",
    provider: "meta",
    now: new Date("2026-10-11T00:00:00.000Z"),
  });
  assert.equal("error" in issued, false);
  if ("error" in issued) return;
  const url = buildMetaAuthorizeUrl({
    config,
    state: issued.state,
    codeChallenge: issued.pkceChallenge,
  });
  const parsed = new URL(url);
  assert.equal(isBrowserSafeMetaRedirect(url), true);
  assert.equal(parsed.searchParams.get("config_id"), META_LOGIN_CONFIGURATION_ID);
  assert.equal(parsed.searchParams.get("redirect_uri"), META_OAUTH_REDIRECT_URI);
  assert.equal(parsed.searchParams.get("response_type"), "code");
  assert.equal(parsed.searchParams.get("code_challenge_method"), "S256");
  assert.equal(parsed.searchParams.has("scope"), false);
  assert.equal(url.includes(config.appSecret), false);
  assert.equal(url.includes(issued.pkceVerifier), false);
  assert.equal(stagingSettingsUrl({ meta_error: "https://evil.example" }).includes("evil"), false);
});

test("callback rejects expired, reused, switched, and mismatched OAuth state", () => {
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = encryptionKey;
  const issued = createOAuthState({
    tenantId: "tenant-a",
    userId: "user-a",
    provider: "meta",
    now: new Date("2026-10-11T00:00:00.000Z"),
  });
  if ("error" in issued) assert.fail("state");
  const base = {
    presentedState: issued.state,
    storedStateHash: issued.stateHash,
    storedTenantId: issued.tenantId,
    sessionTenantId: issued.tenantId,
    storedUserId: issued.userId,
    sessionUserId: issued.userId,
    storedProvider: "meta",
    presentedProvider: "meta",
    expiresAt: issued.expiresAt,
    consumedAt: null,
    now: new Date("2026-10-11T00:01:00.000Z"),
  };
  assert.equal(assertOAuthCallback({ ...base, sessionTenantId: "tenant-b" }).reason, "tenant_mismatch");
  assert.equal(assertOAuthCallback({ ...base, sessionUserId: "user-b" }).reason, "user_mismatch");
  assert.equal(assertOAuthCallback({ ...base, presentedProvider: "tiktok" }).reason, "provider_mismatch");
  assert.equal(assertOAuthCallback({ ...base, now: new Date("2026-10-11T00:11:00.000Z") }).reason, "expired");
  assert.equal(assertOAuthCallback({ ...base, consumedAt: issued.expiresAt }).reason, "consumed");
});

test("denied, failed exchange, and missing permissions do not become connected", async () => {
  assert.equal(metaCallbackError(new URLSearchParams("error=access_denied")), "denied");
  const denied = await runMetaCallback({
    query: new URLSearchParams("error=access_denied&state=abc"),
    session: { userId: "user-a", tenantId: "tenant-a", role: "owner" },
    capabilityEnabled: true,
    configured: true,
    production: false,
    config,
    consumeState: async () => ({ outcome: "ok", tenantId: "tenant-a", userId: "user-a", pkceCiphertext: "aa", pkceNonce: "bb" }),
    decryptPkce: () => "verifier",
    exchangeCode: async () => {
      throw new Error("should not exchange a denied login");
    },
    persist: async () => {
      throw new Error("should not persist a denied login");
    },
  });
  assert.deepEqual(denied, { notice: "denied" });

  let persisted = false;
  const failed = await runMetaCallback({
    query: new URLSearchParams("code=auth-code&state=abc"),
    session: { userId: "user-a", tenantId: "tenant-a", role: "owner" },
    capabilityEnabled: true,
    configured: true,
    production: false,
    config,
    consumeState: async () => ({ outcome: "ok", tenantId: "tenant-a", userId: "user-a", pkceCiphertext: "aa", pkceNonce: "bb" }),
    decryptPkce: () => "verifier",
    exchangeCode: async () => ({ ok: false, reason: "exchange_failed" }),
    persist: async () => {
      persisted = true;
      return true;
    },
  });
  assert.deepEqual(failed, { notice: "exchange_failed" });
  assert.equal(persisted, false);
  assert.equal(planCallbackPersistence({ exchangeOk: false, permissionsOk: true }).persist, false);

  const token = "EAA-user-token-should-not-leak";
  const saved = [];
  const missing = await runMetaCallback({
    query: new URLSearchParams("code=auth-code&state=abc"),
    session: { userId: "user-a", tenantId: "tenant-a", role: "manager" },
    capabilityEnabled: true,
    configured: true,
    production: false,
    config,
    consumeState: async () => ({ outcome: "ok", tenantId: "tenant-a", userId: "user-a", pkceCiphertext: "aa", pkceNonce: "bb" }),
    decryptPkce: () => "verifier",
    exchangeCode: async () => ({
      ok: true,
      accessToken: token,
      expiresAt: null,
      scopes: ["pages_show_list"],
      userId: "100",
      displayName: "Salon",
      permissionsOk: missingRequiredScopes(["pages_show_list"]).length === 0,
    }),
    persist: async (row) => {
      saved.push(row);
      return true;
    },
  });
  assert.deepEqual(missing, { notice: "permissions" });
  assert.equal(saved[0].status, "error");
  assert.notEqual(saved[0].status, "connected");
  assert.equal(JSON.stringify(missing).includes(token), false);
});

test("callback state mismatches and expiry are explicit", async () => {
  const session = { userId: "user-a", tenantId: "tenant-a", role: "owner" };
  const cases = [
    [{ outcome: "expired" }, "expired"],
    [{ outcome: "consumed" }, "consumed"],
    [{ outcome: "provider_mismatch" }, "mismatch"],
    [{ outcome: "ok", tenantId: "tenant-b", userId: "user-a", pkceCiphertext: "a", pkceNonce: "b" }, "mismatch"],
    [{ outcome: "ok", tenantId: "tenant-a", userId: "user-b", pkceCiphertext: "a", pkceNonce: "b" }, "mismatch"],
  ];
  for (const [consumed, notice] of cases) {
    const result = await runMetaCallback({
      query: new URLSearchParams("code=auth-code&state=abc"),
      session,
      capabilityEnabled: true,
      configured: true,
      production: false,
      config,
      consumeState: async () => consumed,
      decryptPkce: () => "verifier",
      exchangeCode: async () => {
        throw new Error("mismatched state must not exchange");
      },
      persist: async () => true,
    });
    assert.deepEqual(result, { notice });
  }
});

test("pages with and without Instagram are selectable and tokens are stripped", () => {
  const pages = parseMetaPages({
    data: [
      {
        id: "10",
        name: "Page A",
        tasks: ["ANALYZE"],
        access_token: "EAA-page-token",
        instagram_business_account: null,
      },
      {
        id: "20",
        name: "Page B",
        tasks: ["CREATE_CONTENT"],
        access_token: "EAA-page-token-2",
        instagram_business_account: {
          id: "300",
          username: "salon.b",
          access_token: "EAA-ig-token",
        },
      },
    ],
  });
  assert.equal(pages.length, 2);
  assert.equal(pages[0].instagram, null);
  assert.equal(pages[1].instagram.username, "salon.b");
  assert.equal(containsSecretMaterial(pages), false);

  const pageOnly = planMetaDestinationSave(pages, [{ type: "facebook_page", id: "10" }]);
  assert.equal(pageOnly.ok, true);
  if (!pageOnly.ok) return;
  assert.equal(pageOnly.rows.length, 1);
  assert.equal(containsSecretMaterial(pageOnly.rows), false);

  const withInstagram = planMetaDestinationSave(pages, [
    { type: "facebook_page", id: "20" },
    { type: "instagram_business", id: "300" },
  ]);
  assert.equal(withInstagram.ok, true);
  if (!withInstagram.ok) return;
  assert.deepEqual(withInstagram.rows.map((row) => row.destination_type), [
    "facebook_page",
    "instagram_business",
  ]);
  assert.equal(planMetaDestinationSave(pages, [{ type: "instagram_business", id: "300" }]).reason, "instagram_without_page");
  const view = presentMetaDestination({
    destinationType: "instagram_business",
    displayName: "@salon.b",
    metadata: { username: "salon.b", facebook_page_id: "20", access_token: "EAA-hidden" },
  });
  assert.equal(JSON.stringify(view).includes("EAA-hidden"), false);
});

test("reconnect updates one connection and disconnect does not claim an unconfirmed revoke", () => {
  assert.deepEqual(planMetaUpsert("connection-1"), { mode: "update", connectionId: "connection-1" });
  assert.deepEqual(planMetaUpsert(null), { mode: "insert", connectionId: null });
  assert.equal(planDisconnect({ attempted: false, remoteConfirmed: false }).remoteRevocation, "not_attempted");
  assert.equal(planDisconnect({ attempted: true, remoteConfirmed: false }).notice, "disconnected_local_only");
  assert.equal(planDisconnect({ attempted: true, remoteConfirmed: true }).notice, "disconnected_remote");
  assert.equal(planDisconnect({ attempted: false, remoteConfirmed: false }).local, "removed");
  assert.equal(
    effectiveMetaStatus("connected", "2026-10-01T00:00:00.000Z", new Date("2026-10-11T00:00:00.000Z")),
    "needs_reconnect",
  );
});

test("debug token from another app is rejected and required scopes are explicit", () => {
  assert.equal(parseDebugToken({ data: { app_id: "999", is_valid: true, user_id: "1", scopes: [] } }, META_APP_ID).ok, false);
  const parsed = parseDebugToken({
    data: {
      app_id: META_APP_ID,
      is_valid: true,
      type: "USER",
      user_id: "42",
      expires_at: 0,
      granular_scopes: [
        { scope: "business_management" },
        { scope: "instagram_basic" },
        { scope: "instagram_content_publish" },
        { scope: "pages_read_engagement" },
        { scope: "pages_show_list" },
      ],
    },
  }, META_APP_ID);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(missingRequiredScopes(parsed.scopes), []);
});

test("Meta routes do not publish and do not touch booking or Marketing AI", () => {
  assert.equal(createMockPublishJob({ provider: "meta" }).externalCall, false);
  assert.equal(createMockPublishJob({ provider: "meta" }).status, "draft");
  const files = [
    "lib/integrations/meta/graph.ts",
    "lib/integrations/meta/handlers.ts",
    "app/api/integrations/meta/callback/route.ts",
    "app/admin/settings/integrations/page.tsx",
    "app/admin/integrations/page.tsx",
  ];
  for (const file of files) {
    const source = readFileSync(join(parent, file), "utf8");
    assert.doesNotMatch(source, /media_publish|\/feed|\/photos|\/reels|\/stories/);
    assert.doesNotMatch(source, /lib\/billing|lib\/google\/|lib\/marketing-ai|lib\/bookings|stripe/);
    assert.doesNotMatch(source, /console\.log/);
  }
  for (const file of [
    "app/api/integrations/meta/connect/route.ts",
    "app/api/integrations/meta/callback/route.ts",
    "app/api/integrations/meta/destinations/route.ts",
    "app/api/integrations/meta/destinations/select/route.ts",
    "app/api/integrations/meta/disconnect/route.ts",
  ]) {
    const source = readFileSync(join(parent, file), "utf8");
    assert.match(source, /export const maxDuration = 10/);
  }
  const sentry = readFileSync(join(parent, "lib/sentry/shared.ts"), "utf8");
  assert.match(sentry, /"state"/);
  assert.match(sentry, /"code"/);
  const migration = readFileSync(
    join(parent, "supabase/migrations/20261011073500_frizeo_v2_meta_oauth.sql"),
    "utf8",
  );
  assert.match(migration, /revoke all on function public.meta_read_connection_secret/);
  assert.match(migration, /grant execute on function public.meta_upsert_connection/);
  assert.doesNotMatch(migration, /access_token text/);
});
