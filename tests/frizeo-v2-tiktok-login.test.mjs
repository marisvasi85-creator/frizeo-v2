import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createOAuthState, pkceS256 } from "../lib/integrations/oauth/state.ts";
import { getProviderAdapter } from "../lib/integrations/providers/registry.ts";
import { encryptIntegrationSecret, decryptIntegrationSecret } from "../lib/integrations/crypto.ts";
import {
  assertTikTokConfig,
  TIKTOK_REDIRECT_URI,
  TIKTOK_SCOPE,
} from "../lib/integrations/tiktok/config.ts";
import {
  exchangeTikTokCode,
  fetchTikTokUser,
} from "../lib/integrations/tiktok/api.ts";
import {
  buildTikTokAuthorizeUrl,
  decideTikTokConnect,
  encodeTikTokToken,
  parseTikTokToken,
  parseTikTokUser,
  publicTikTokConnection,
  readTikTokToken,
} from "../lib/integrations/tiktok/flow.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const key = Buffer.alloc(32, 4).toString("base64");

test("tiktok connect stays closed in production and without server config", () => {
  assert.equal(assertTikTokConfig({}, { production: false }).ok, false);
  assert.equal(assertTikTokConfig({
    TIKTOK_CLIENT_KEY: "key",
    TIKTOK_CLIENT_SECRET: "secret",
    INTEGRATION_TOKEN_ENCRYPTION_KEY: key,
  }, { production: true }).reason, "production");
  const ready = assertTikTokConfig({
    TIKTOK_CLIENT_KEY: "staging-key",
    TIKTOK_CLIENT_SECRET: "staging-secret",
    INTEGRATION_TOKEN_ENCRYPTION_KEY: key,
  }, { production: false });
  assert.equal(ready.ok, true);
  assert.equal(decideTikTokConnect({
    authenticated: true,
    role: "owner",
    configured: true,
    production: false,
  }).ok, true);
  assert.equal(decideTikTokConnect({
    authenticated: true,
    role: "staff",
    configured: true,
    production: false,
  }).reason, "forbidden");
});

test("tiktok authorize url uses PKCE, state, and only the identity scope", () => {
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = key;
  const issued = createOAuthState({
    tenantId: "tenant-a",
    userId: "user-a",
    provider: "tiktok",
  });
  assert.equal("error" in issued, false);
  if ("error" in issued) return;
  const url = new URL(buildTikTokAuthorizeUrl({
    config: {
      clientKey: "staging-key",
      redirectUri: TIKTOK_REDIRECT_URI,
      scope: TIKTOK_SCOPE,
    },
    state: issued.state,
    codeChallenge: issued.pkceChallenge,
  }));
  assert.equal(url.origin + url.pathname, "https://www.tiktok.com/v2/auth/authorize/");
  assert.equal(url.searchParams.get("client_key"), "staging-key");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), "user.info.basic");
  assert.equal(url.searchParams.get("redirect_uri"), TIKTOK_REDIRECT_URI);
  assert.equal(url.searchParams.get("state"), issued.state);
  assert.equal(url.searchParams.get("code_challenge"), pkceS256(issued.pkceVerifier));
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("client_secret"), null);
  assert.equal(url.search.includes("video.publish"), false);
});

test("tiktok token exchange accepts only the identity scope and keeps the open id", async () => {
  const lines = [];
  const original = console.error;
  console.error = (...args) => {
    lines.push(args.map((part) => String(part)).join(" "));
  };
  const secret = "staging-client-secret";
  try {
    const ok = await exchangeTikTokCode({
      config: {
        clientKey: "staging-key",
        clientSecret: secret,
        redirectUri: TIKTOK_REDIRECT_URI,
        scope: TIKTOK_SCOPE,
      },
      code: "auth-code",
      codeVerifier: "verifier-value",
      http: async (input) => {
        assert.equal(input.url, "https://open.tiktokapis.com/v2/oauth/token/");
        assert.equal(input.body.includes("code_verifier=verifier-value"), true);
        assert.equal(input.body.includes(secret), true);
        return {
          status: 200,
          body: {
            access_token: "access-value",
            refresh_token: "refresh-value",
            expires_in: 7200,
            refresh_expires_in: 86400,
            open_id: "open-id.1",
            scope: "user.info.basic",
            token_type: "Bearer",
          },
        };
      },
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.openId, "open-id.1");

    const forbidden = await exchangeTikTokCode({
      config: {
        clientKey: "staging-key",
        clientSecret: secret,
        redirectUri: TIKTOK_REDIRECT_URI,
        scope: TIKTOK_SCOPE,
      },
      code: "auth-code",
      codeVerifier: "verifier-value",
      http: async () => ({
        status: 403,
        body: {
          error: "access_denied",
          error_description: `denied for owner@frizeo.ro secret ${secret}`,
        },
      }),
    });
    assert.equal(forbidden.ok, false);

    const limited = await exchangeTikTokCode({
      config: {
        clientKey: "staging-key",
        clientSecret: secret,
        redirectUri: TIKTOK_REDIRECT_URI,
        scope: TIKTOK_SCOPE,
      },
      code: "auth-code",
      codeVerifier: "verifier-value",
      http: async () => ({
        status: 429,
        body: { error: "rate_limit_exceeded", error_description: "slow down" },
      }),
    });
    assert.equal(limited.ok, false);

    const network = await exchangeTikTokCode({
      config: {
        clientKey: "staging-key",
        clientSecret: secret,
        redirectUri: TIKTOK_REDIRECT_URI,
        scope: TIKTOK_SCOPE,
      },
      code: "auth-code",
      codeVerifier: "verifier-value",
      http: async () => {
        throw new Error(`socket hang up ${secret}`);
      },
    });
    assert.deepEqual(network, { ok: false, reason: "network" });
  } finally {
    console.error = original;
  }
  const log = lines.join("\n");
  assert.match(log, /"httpStatus":403/);
  assert.match(log, /access_denied/);
  assert.match(log, /"httpStatus":429/);
  assert.equal(log.includes(secret), false);
  assert.equal(log.includes("owner@frizeo.ro"), false);
  assert.equal(log.includes("socket hang up"), false);
});

test("reconnect accepts the previously granted upload scope in any order", () => {
  const token = {
    access_token: "act.example",
    refresh_token: "rft.example",
    expires_in: 86400,
    refresh_expires_in: 31536000,
    open_id: "open-id.1",
  };
  const reversed = parseTikTokToken({
    ...token,
    scope: "video.upload,user.info.basic",
  }, "identity");
  assert.equal(reversed.ok, true);
  if (reversed.ok) {
    assert.deepEqual(reversed.scopes, ["user.info.basic", "video.upload"]);
    assert.equal(reversed.grantedUpload, true);
  }
  const spaced = parseTikTokToken({
    ...token,
    scope: "user.info.basic, video.upload",
  }, "identity");
  assert.equal(spaced.ok, true);
  if (spaced.ok) assert.deepEqual(spaced.scopes, ["user.info.basic", "video.upload"]);
  const requested = parseTikTokToken({
    ...token,
    scope: "user.info.basic,video.upload",
  }, "upload");
  assert.equal(requested.ok, true);
  if (requested.ok) assert.equal(requested.grantedUpload, true);
  assert.equal(parseTikTokToken({ ...token, scope: "video.upload" }, "identity").reason, "missing_scope");
  assert.equal(parseTikTokToken({ ...token, scope: "" }, "upload").reason, "missing_scope");
  assert.equal(parseTikTokToken({ ...token, scope: "user.info.basic" }, "upload").reason, "missing_scope");
  assert.equal(parseTikTokToken({
    ...token,
    scope: "user.info.basic,video.list",
  }, "identity").reason, "unexpected_scope");
  const identityOnly = parseTikTokToken({ ...token, scope: "user.info.basic" }, "identity");
  assert.equal(identityOnly.ok, true);
  if (identityOnly.ok) {
    assert.deepEqual(identityOnly.scopes, ["user.info.basic"]);
    assert.equal(identityOnly.grantedUpload, false);
  }
});

test("tiktok rejects publish scopes, empty identity, and a mismatched profile", () => {
  assert.equal(parseTikTokToken({
    access_token: "a",
    refresh_token: "r",
    expires_in: 7200,
    open_id: "open-id.1",
    scope: "user.info.basic,video.publish",
  }).reason, "publish_scope");
  assert.equal(parseTikTokToken({
    access_token: "a",
    refresh_token: "r",
    expires_in: 7200,
    open_id: "open-id.1",
    scope: "user.info.basic",
  }).ok, true);
  assert.equal(parseTikTokToken({
    access_token: "a",
    open_id: "open-id.1",
    scope: "user.info.basic",
    expires_in: 7200,
  }).reason, "missing_refresh");
  const user = parseTikTokUser({
    data: { user: { open_id: "open-id.1", display_name: "Frizeo" } },
    error: { code: "ok", message: "" },
  }, "open-id.1");
  assert.equal(user.ok, true);
  if (user.ok) assert.equal(user.displayName, "Frizeo");
  assert.equal(parseTikTokUser({
    data: { user: { open_id: "other-id", display_name: "Altul" } },
    error: { code: "ok" },
  }, "open-id.1").reason, "account_mismatch");
  assert.deepEqual(publicTikTokConnection({
    displayName: "Frizeo",
    status: "connected",
    scopes: ["user.info.basic", "video.publish"],
  }).scopes, ["user.info.basic"]);
});

test("tiktok user lookup and stored secret do not keep a failed identity", async () => {
  const mismatch = await fetchTikTokUser({
    accessToken: "access-value",
    openId: "open-id.1",
    http: async () => ({
      status: 200,
      body: {
        data: { user: { open_id: "other-id", display_name: "Altul" } },
        error: { code: "ok", message: "" },
      },
    }),
  });
  assert.equal(mismatch.ok, false);
  const offline = await fetchTikTokUser({
    accessToken: "access-value",
    openId: "open-id.1",
    http: async () => {
      throw new Error("network down access-value");
    },
  });
  assert.deepEqual(offline, { ok: false, reason: "network" });

  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = key;
  const encoded = encodeTikTokToken({
    accessToken: "access-value",
    refreshToken: "refresh-value",
    obtainedAt: "2026-11-11T15:00:00.000Z",
    refreshExpiresIn: 86400,
  });
  const encrypted = encryptIntegrationSecret(encoded);
  assert.equal("error" in encrypted, false);
  if ("error" in encrypted) return;
  const decoded = readTikTokToken(decryptIntegrationSecret(encrypted));
  assert.equal(decoded?.accessToken, "access-value");
  assert.equal(encrypted.ciphertext.includes(Buffer.from("access-value")), false);
});

test("tiktok publish stays unimplemented and the migration does not touch other providers", async () => {
  assert.deepEqual(await getProviderAdapter("tiktok").publish(), {
    implemented: false,
    reason: "not_implemented",
  });
  const migration = readFileSync(join(root, "supabase/migrations/20261111180000_frizeo_v2_tiktok_login.sql"), "utf8");
  assert.equal(migration.includes("integration_oauth_state_consume"), false);
  assert.equal(migration.includes("google_business"), false);
  assert.equal(migration.includes("marketing.publish.tiktok"), true);
  assert.equal(migration.includes("video.publish"), false);
  const page = readFileSync(join(root, "app/admin/settings/integrations/page.tsx"), "utf8");
  assert.match(page, /\/api\/integrations\/tiktok\/connect/);
  assert.match(page, /\/api\/integrations\/tiktok\/disconnect/);
  assert.doesNotMatch(page, /access_token|refresh_token|client_secret/);
  const source = readFileSync(join(root, "lib/integrations/tiktok/config.ts"), "utf8");
  assert.match(source, /process\.env/);
  assert.equal(source.includes("aw123"), false);
});
