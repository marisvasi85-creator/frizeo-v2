import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { isProduction } from "@/lib/app/environment";
import { createOAuthState, hashOAuthState } from "@/lib/integrations/oauth/state";
import { canAdministerIntegrations } from "@/lib/integrations/permissions";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { assertTikTokConfig, TIKTOK_SCOPE } from "@/lib/integrations/tiktok/config";
import { createTikTokHttp, exchangeTikTokCode, fetchTikTokUser } from "@/lib/integrations/tiktok/api";
import {
  buildTikTokAuthorizeUrl,
  decideTikTokConnect,
  stagingTikTokSettingsUrl,
  type TikTokNotice,
} from "@/lib/integrations/tiktok/flow";
import {
  consumeTikTokOAuthState,
  decryptTikTokSecret,
  deleteTikTokConnection,
  encryptTikTokSecret,
  insertTikTokOAuthState,
  upsertTikTokConnection,
} from "@/lib/integrations/tiktok/store";

function tikTokRedirect(notice: TikTokNotice): NextResponse {
  const key = notice === "connected" ? "tiktok" : "tiktok_error";
  return NextResponse.redirect(stagingTikTokSettingsUrl({ [key]: notice }), 303);
}

async function loadContext() {
  const session = await getAdminSession();
  const production = isProduction();
  const configResult = assertTikTokConfig(process.env, { production });
  return {
    session,
    production,
    configured: configResult.ok,
    config: configResult.ok ? configResult.config : null,
  };
}

export async function startTikTokConnect(request: Request) {
  if (isProduction()) return NextResponse.json({ error: "not_configured" }, { status: 404 });
  const context = await loadContext();
  const limited = await enforceRateLimit(request, {
    bucket: "tiktok-connect",
    limit: 10,
    windowSeconds: 600,
    identifier: context.session?.user.id ?? "anonymous",
  });
  if (limited) return limited;
  const gate = decideTikTokConnect({
    authenticated: Boolean(context.session?.user && context.session.tenantId),
    role: context.session?.role ?? null,
    configured: context.configured,
    production: context.production,
  });
  if (!context.session?.user || !context.session.tenantId || !context.config || !gate.ok) {
    if (!context.session?.user) {
      return NextResponse.redirect("https://staging.frizeo.ro/login", 303);
    }
    const notice: TikTokNotice =
      gate.ok ? "unconfigured"
      : gate.reason === "forbidden" ? "forbidden"
      : gate.reason === "production" ? "production"
      : "unconfigured";
    return tikTokRedirect(notice);
  }

  const issued = createOAuthState({
    tenantId: context.session.tenantId,
    userId: context.session.user.id,
    provider: "tiktok",
  });
  if ("error" in issued) return tikTokRedirect("unconfigured");
  const encrypted = encryptTikTokSecret(issued.pkceVerifier);
  if (!encrypted) return tikTokRedirect("unconfigured");
  const stored = await insertTikTokOAuthState({
    tenantId: context.session.tenantId,
    userId: context.session.user.id,
    stateHash: issued.stateHash,
    pkceCiphertext: encrypted.ciphertext,
    pkceNonce: encrypted.nonce,
    expiresAt: issued.expiresAt,
  });
  if (!stored) return tikTokRedirect("invalid");
  return NextResponse.redirect(buildTikTokAuthorizeUrl({
    config: context.config,
    state: issued.state,
    codeChallenge: issued.pkceChallenge,
  }), 303);
}

export async function finishTikTokCallback(request: Request) {
  if (isProduction()) return NextResponse.json({ error: "not_configured" }, { status: 404 });
  const context = await loadContext();
  if (!context.session?.user || !context.session.tenantId || !context.config) {
    if (!context.session?.user) {
      return NextResponse.redirect("https://staging.frizeo.ro/login", 303);
    }
    return tikTokRedirect(context.production ? "production" : "unconfigured");
  }
  const limited = await enforceRateLimit(request, {
    bucket: "tiktok-callback",
    limit: 20,
    windowSeconds: 600,
    identifier: context.session.user.id,
  });
  if (limited) return limited;

  const url = new URL(request.url);
  if (url.searchParams.get("error")) return tikTokRedirect("denied");
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const stateHash = hashOAuthState(state);
  if (!code || !stateHash) return tikTokRedirect("invalid");
  const consumed = await consumeTikTokOAuthState(stateHash);
  if (consumed.outcome !== "ok") {
    const notice: TikTokNotice =
      consumed.outcome === "expired" || consumed.outcome === "consumed"
        ? consumed.outcome
        : "mismatch";
    return tikTokRedirect(notice);
  }
  if (consumed.tenantId !== context.session.tenantId || consumed.userId !== context.session.user.id) {
    return tikTokRedirect("mismatch");
  }
  const verifier = decryptTikTokSecret(consumed.pkceCiphertext, consumed.pkceNonce);
  if (!verifier) return tikTokRedirect("invalid");

  const token = await exchangeTikTokCode({
    http: createTikTokHttp(),
    config: context.config,
    code,
    codeVerifier: verifier,
  });
  if (!token.ok) {
    if (token.reason === "network") return tikTokRedirect("network");
    if (token.reason === "missing_scope" || token.reason === "publish_scope") return tikTokRedirect("permissions");
    if (token.reason === "missing_expiry") return tikTokRedirect("unknown_expiry");
    if (token.reason === "invalid_account") return tikTokRedirect("account_mismatch");
    return tikTokRedirect("exchange_failed");
  }

  const user = await fetchTikTokUser({
    http: createTikTokHttp(),
    accessToken: token.accessToken,
    openId: token.openId,
  });
  if (!user.ok) {
    if (user.reason === "network") return tikTokRedirect("network");
    return tikTokRedirect(user.reason === "account_mismatch" ? "account_mismatch" : "exchange_failed");
  }

  const saved = await upsertTikTokConnection({
    tenantId: context.session.tenantId,
    userId: context.session.user.id,
    openId: user.openId,
    displayName: user.displayName,
    scopes: [TIKTOK_SCOPE],
    tokenExpiresAt: new Date(Date.now() + token.expiresIn * 1000).toISOString(),
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    refreshExpiresIn: token.refreshExpiresIn,
  });
  if (!saved) return tikTokRedirect("invalid");
  return tikTokRedirect("connected");
}

export async function disconnectTikTok(_request: Request) {
  if (isProduction()) return NextResponse.json({ error: "not_configured" }, { status: 404 });
  const session = await getAdminSession();
  if (!session?.user || !session.tenantId) {
    return NextResponse.redirect("https://staging.frizeo.ro/login", 303);
  }
  if (!canAdministerIntegrations(session.role)) return tikTokRedirect("forbidden");
  const removed = await deleteTikTokConnection(session.tenantId);
  return tikTokRedirect(removed ? "disconnected" : "invalid");
}
