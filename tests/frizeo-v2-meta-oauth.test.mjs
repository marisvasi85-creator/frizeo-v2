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
  META_REQUIRED_SCOPES,
  assertMetaConfig,
} from "../lib/integrations/meta/config.ts";
import {
  assessStoredTokenExpiry,
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
  readAccountsCursor,
  resolveUserTokenExpiry,
  stagingSettingsUrl,
} from "../lib/integrations/meta/flow.ts";
import {
  GRAPH_BUDGET_MS,
  GRAPH_CALL_MAX_MS,
  MAX_ACCOUNT_PAGES,
  createGraphBudget,
  createMetaHttp,
  exchangeMetaAuthorization,
  fetchMetaPages,
  reserveGraphCall,
} from "../lib/integrations/meta/graph.ts";
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
      expiresAt: "2026-12-11T00:00:00.000Z",
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
  assert.equal(
    effectiveMetaStatus("connected", null, new Date("2026-10-11T00:00:00.000Z")),
    "needs_reconnect",
  );
  assert.equal(
    effectiveMetaStatus("setup_required", "not-a-date", new Date("2026-10-11T00:00:00.000Z")),
    "needs_reconnect",
  );
  assert.equal(
    effectiveMetaStatus("connected", "2026-12-01T00:00:00.000Z", new Date("2026-10-11T00:00:00.000Z")),
    "connected",
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
  assert.equal(parsed.expiresAt, null);
  assert.equal(parsed.dataAccessExpiresAt, null);
  assert.deepEqual(missingRequiredScopes(parsed.scopes), []);
});

const expiryNow = new Date("2026-10-11T00:00:00.000Z");

function debugPayload(overrides = {}) {
  return {
    data: {
      app_id: META_APP_ID,
      is_valid: true,
      type: "USER",
      user_id: "42",
      scopes: [...META_REQUIRED_SCOPES],
      expires_at: Math.floor(expiryNow.getTime() / 1000) + 60 * 24 * 3600,
      data_access_expires_at: Math.floor(expiryNow.getTime() / 1000) + 10 * 24 * 3600,
      ...overrides,
    },
  };
}

function scriptedGraph(steps) {
  let index = 0;
  return async (url, init) => {
    const step = steps[index];
    index += 1;
    if (!step) throw new Error(`unexpected Graph call ${url}`);
    return step(url, init);
  };
}

test("a user token is usable only with a finite future expiry", async () => {
  const dataAccess = new Date(expiryNow.getTime() + 10 * 24 * 3600 * 1000).toISOString();
  const exchanged = await exchangeMetaAuthorization({
    config,
    code: "auth-code",
    codeVerifier: "verifier",
    now: expiryNow,
    http: scriptedGraph([
      async () => ({ ok: true, status: 200, body: { access_token: "short-lived-token", expires_in: 3600 } }),
      async () => ({ ok: true, status: 200, body: { access_token: "long-lived-token", expires_in: 5184000 } }),
      async () => ({ ok: true, status: 200, body: debugPayload() }),
      async () => ({ ok: true, status: 200, body: { id: "42", name: "Salon" } }),
    ]),
  });
  assert.equal(exchanged.ok, true);
  if (!exchanged.ok) return;
  assert.equal(exchanged.expiresAt, dataAccess);
  assert.equal(exchanged.accessToken, "long-lived-token");

  const fromDataAccessOnly = resolveUserTokenExpiry({
    expiresInSeconds: null,
    debugExpiresAt: null,
    dataAccessExpiresAt: dataAccess,
    now: expiryNow,
  });
  assert.equal(fromDataAccessOnly.ok, true);
  if (!fromDataAccessOnly.ok) return;
  assert.equal(fromDataAccessOnly.expiresAt, dataAccess);
  assert.equal(assessStoredTokenExpiry(dataAccess, expiryNow).ok, true);
});

test("an expired user token is not stored", async () => {
  let persisted = false;
  const past = Math.floor(expiryNow.getTime() / 1000) - 3600;
  const exchanged = await exchangeMetaAuthorization({
    config,
    code: "auth-code",
    codeVerifier: "verifier",
    now: expiryNow,
    http: scriptedGraph([
      async () => ({ ok: true, status: 200, body: { access_token: "short-lived-token", expires_in: 5184000 } }),
      async () => ({ ok: true, status: 200, body: { access_token: "long-lived-token", expires_in: 5184000 } }),
      async () => ({
        ok: true,
        status: 200,
        body: debugPayload({ expires_at: past, data_access_expires_at: past }),
      }),
    ]),
  });
  assert.deepEqual(exchanged, { ok: false, reason: "token_expired" });
  const callback = await runMetaCallback({
    query: new URLSearchParams("code=auth-code&state=abc"),
    session: { userId: "user-a", tenantId: "tenant-a", role: "owner" },
    capabilityEnabled: true,
    configured: true,
    production: false,
    config,
    consumeState: async () => ({ outcome: "ok", tenantId: "tenant-a", userId: "user-a", pkceCiphertext: "aa", pkceNonce: "bb" }),
    decryptPkce: () => "verifier",
    exchangeCode: async () => exchanged,
    persist: async () => {
      persisted = true;
      return true;
    },
  });
  assert.deepEqual(callback, { notice: "token_expired" });
  assert.equal(persisted, false);
  assert.equal(assessStoredTokenExpiry("2026-10-01T00:00:00.000Z", expiryNow).reason, "token_expired");
});

test("unknown token expiry fails closed and is not stored", async () => {
  let persisted = false;
  const exchanged = await exchangeMetaAuthorization({
    config,
    code: "auth-code",
    codeVerifier: "verifier",
    now: expiryNow,
    http: scriptedGraph([
      async () => ({ ok: true, status: 200, body: { access_token: "short-lived-token" } }),
      async () => ({ ok: false, status: 400, body: {} }),
      async () => ({
        ok: true,
        status: 200,
        body: debugPayload({ expires_at: 0, data_access_expires_at: 0 }),
      }),
    ]),
  });
  assert.deepEqual(exchanged, { ok: false, reason: "unknown_expiry" });
  assert.equal(
    resolveUserTokenExpiry({
      expiresInSeconds: null,
      debugExpiresAt: null,
      dataAccessExpiresAt: null,
      now: expiryNow,
    }).reason,
    "unknown_expiry",
  );
  const callback = await runMetaCallback({
    query: new URLSearchParams("code=auth-code&state=abc"),
    session: { userId: "user-a", tenantId: "tenant-a", role: "owner" },
    capabilityEnabled: true,
    configured: true,
    production: false,
    config,
    consumeState: async () => ({ outcome: "ok", tenantId: "tenant-a", userId: "user-a", pkceCiphertext: "aa", pkceNonce: "bb" }),
    decryptPkce: () => "verifier",
    exchangeCode: async () => ({
      ok: true,
      accessToken: "EAA-unknown",
      expiresAt: null,
      scopes: [...META_REQUIRED_SCOPES],
      userId: "42",
      displayName: "Salon",
      permissionsOk: true,
    }),
    persist: async () => {
      persisted = true;
      return true;
    },
  });
  assert.deepEqual(callback, { notice: "unknown_expiry" });
  assert.equal(persisted, false);
  assert.equal(assessStoredTokenExpiry(null, expiryNow).reason, "unknown_expiry");
});

test("me/accounts pagination stays on Graph, caps pages, and drops page tokens", async () => {
  assert.equal(readAccountsCursor(null).after, null);
  assert.equal(
    readAccountsCursor("https://evil.example/v26.0/me/accounts?after=abc").ok,
    false,
  );
  assert.equal(
    readAccountsCursor("https://graph.facebook.com/v26.0/me/permissions?after=abc").ok,
    false,
  );
  assert.equal(
    readAccountsCursor("https://graph.facebook.com/v26.0/me/accounts").ok,
    false,
  );
  assert.equal(
    readAccountsCursor("http://graph.facebook.com/v26.0/me/accounts?after=abc").ok,
    false,
  );

  const calls = [];
  const listed = await fetchMetaPages({
    config,
    accessToken: "user-token-value",
    http: async (url, init) => {
      calls.push({ url, init });
      const after = new URL(url).searchParams.get("after");
      if (!after) {
        return {
          ok: true,
          status: 200,
          body: {
            data: [{ id: "10", name: "Page A", tasks: [], access_token: "EAA-page-token" }],
            paging: {
              next: "https://graph.facebook.com/v26.0/123/accounts?access_token=EAA-next-secret&after=CURSOR_ONE",
            },
          },
        };
      }
      assert.equal(after, "CURSOR_ONE");
      return {
        ok: true,
        status: 200,
        body: { data: [{ id: "20", name: "Page B", tasks: ["ANALYZE"] }] },
      };
    },
  });
  assert.equal(listed.ok, true);
  if (!listed.ok) return;
  assert.deepEqual(listed.pages.map((page) => page.id), ["10", "20"]);
  assert.equal(containsSecretMaterial(listed.pages), false);
  assert.equal(JSON.stringify(listed).includes("EAA-page-token"), false);
  assert.equal(JSON.stringify(listed).includes("EAA-next-secret"), false);
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[1].url).origin, "https://graph.facebook.com");
  assert.equal(new URL(calls[1].url).pathname, "/v26.0/me/accounts");
  assert.equal(new URL(calls[1].url).searchParams.has("access_token"), false);
  assert.equal(calls[1].url.includes("EAA-next-secret"), false);
  assert.equal(calls[1].init.headers.Authorization, "Bearer user-token-value");
  assert.ok(calls.every((call) => call.init.timeoutMs <= GRAPH_CALL_MAX_MS));

  const invalid = await fetchMetaPages({
    config,
    accessToken: "user-token-value",
    http: async () => ({
      ok: true,
      status: 200,
      body: {
        data: [{ id: "10", name: "Page A", tasks: [], access_token: "EAA-page-token" }],
        paging: { next: "https://evil.example/steal?after=abc" },
      },
    }),
  });
  assert.deepEqual(invalid, { ok: false, reason: "invalid_paging" });

  let limitedCalls = 0;
  const limited = await fetchMetaPages({
    config,
    accessToken: "user-token-value",
    http: async () => {
      limitedCalls += 1;
      return {
        ok: true,
        status: 200,
        body: {
          data: [{ id: String(limitedCalls), name: `Page ${limitedCalls}`, tasks: [] }],
          paging: { next: `https://graph.facebook.com/v26.0/me/accounts?after=CURSOR_${limitedCalls}` },
        },
      };
    },
  });
  assert.deepEqual(limited, { ok: false, reason: "page_limit" });
  assert.equal(limitedCalls, MAX_ACCOUNT_PAGES);
});

test("Graph calls use one bounded attempt and do not retry a timeout", async () => {
  assert.equal(GRAPH_BUDGET_MS, 8000);
  assert.ok(GRAPH_BUDGET_MS < 10_000);
  const budget = createGraphBudget();
  const reserved = [];
  for (;;) {
    const timeoutMs = reserveGraphCall(budget);
    if (timeoutMs == null) break;
    reserved.push(timeoutMs);
  }
  assert.ok(reserved.every((timeoutMs) => timeoutMs <= GRAPH_CALL_MAX_MS && timeoutMs >= 500));
  assert.ok(reserved.reduce((sum, timeoutMs) => sum + timeoutMs, 0) <= GRAPH_BUDGET_MS);

  let fetches = 0;
  const http = createMetaHttp(async () => {
    fetches += 1;
    throw new Error("abort");
  });
  assert.deepEqual(await http("https://graph.facebook.com/v26.0/me", { timeoutMs: 20 }), {
    ok: false,
    timeout: true,
  });
  assert.equal(fetches, 1);

  let exchangeCalls = 0;
  const timedOut = await exchangeMetaAuthorization({
    config,
    code: "auth-code",
    codeVerifier: "verifier",
    now: expiryNow,
    http: async () => {
      exchangeCalls += 1;
      return { ok: false, timeout: true };
    },
  });
  assert.deepEqual(timedOut, { ok: false, reason: "timeout" });
  assert.equal(exchangeCalls, 1);

  const exhausted = await exchangeMetaAuthorization({
    config,
    code: "auth-code",
    codeVerifier: "verifier",
    now: expiryNow,
    budget: createGraphBudget(100),
    http: async () => {
      throw new Error("budget must stop before the call");
    },
  });
  assert.deepEqual(exhausted, { ok: false, reason: "timeout" });

  let pageCalls = 0;
  const pagedTimeout = await fetchMetaPages({
    config,
    accessToken: "user-token-value",
    budget: createGraphBudget(1999),
    http: async () => {
      pageCalls += 1;
      return {
        ok: true,
        status: 200,
        body: {
          data: [{ id: "10", name: "Page A", tasks: [] }],
          paging: { next: "https://graph.facebook.com/v26.0/me/accounts?after=MORE" },
        },
      };
    },
  });
  assert.deepEqual(pagedTimeout, { ok: false, reason: "timeout" });
  assert.equal(pageCalls, 1);
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
