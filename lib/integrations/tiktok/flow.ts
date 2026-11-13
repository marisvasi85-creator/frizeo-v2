import { canAdministerIntegrations } from "@/lib/integrations/permissions";
import {
  TIKTOK_AUTHORIZE_URL,
  TIKTOK_PUBLISH_SCOPE,
  TIKTOK_SCOPE,
  TIKTOK_UPLOAD_SCOPE,
  isTikTokOpenId,
  type TikTokConfig,
} from "@/lib/integrations/tiktok/config";

export type TikTokNotice =
  | "connected"
  | "denied"
  | "expired"
  | "consumed"
  | "mismatch"
  | "exchange_failed"
  | "permissions"
  | "unconfigured"
  | "forbidden"
  | "production"
  | "disconnected"
  | "invalid"
  | "unknown_expiry"
  | "account_mismatch"
  | "network"
  | "upload_granted"
  | "upload_not_granted"
  | "direct_post_inactive";

export type TikTokConsent = "identity" | "upload";

export type TikTokConnectDecision =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "production" | "unconfigured" | "forbidden" };

export function decideTikTokConnect(input: {
  authenticated: boolean;
  role: string | null;
  configured: boolean;
  production: boolean;
}): TikTokConnectDecision {
  if (!input.authenticated) return { ok: false, reason: "unauthenticated" };
  if (input.production) return { ok: false, reason: "production" };
  if (!input.configured) return { ok: false, reason: "unconfigured" };
  if (!canAdministerIntegrations(input.role)) return { ok: false, reason: "forbidden" };
  return { ok: true };
}

export function scopesForConsent(consent: TikTokConsent): string {
  if (consent === "upload") return `${TIKTOK_SCOPE},${TIKTOK_UPLOAD_SCOPE}`;
  return TIKTOK_SCOPE;
}

export function directPostConsent(): { ok: false; reason: "direct_post_inactive" } {
  return { ok: false, reason: "direct_post_inactive" };
}

export function readTikTokConsent(value: unknown): TikTokConsent | "direct_post" | null {
  if (value === "upload") return "upload";
  if (value === "identity" || value == null || value === "") return "identity";
  if (value === "direct_post") return "direct_post";
  return null;
}

export function encodePkceMaterial(verifier: string, consent: TikTokConsent): string {
  return JSON.stringify({ v: 1, verifier, consent });
}

export function readPkceMaterial(plaintext: string): { verifier: string; consent: TikTokConsent } | null {
  if (!plaintext.startsWith("{")) {
    return plaintext.length >= 43 ? { verifier: plaintext, consent: "identity" } : null;
  }
  try {
    const parsed = JSON.parse(plaintext) as { verifier?: unknown; consent?: unknown };
    if (typeof parsed.verifier !== "string" || parsed.verifier.length < 43) return null;
    if (parsed.consent === "upload" || parsed.consent === "identity") {
      return { verifier: parsed.verifier, consent: parsed.consent };
    }
    return null;
  } catch {
    return null;
  }
}

export function buildTikTokAuthorizeUrl(input: {
  config: Pick<TikTokConfig, "clientKey" | "redirectUri" | "scope">;
  state: string;
  codeChallenge: string;
  scope?: string;
}): string {
  const scope = input.scope ?? input.config.scope;
  if (scope.split(",").includes(TIKTOK_PUBLISH_SCOPE)) {
    throw new Error("direct_post_inactive");
  }
  const url = new URL(TIKTOK_AUTHORIZE_URL);
  url.searchParams.set("client_key", input.config.clientKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("redirect_uri", input.config.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("disable_auto_auth", "1");
  return url.toString();
}

export function stagingTikTokSettingsUrl(params: Record<string, string>): string {
  const url = new URL("https://staging.frizeo.ro/admin/settings/integrations");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function tikTokScopes(value: string | null): string[] {
  if (!value) return [];
  return value.split(/[,\s]+/).map((scope) => scope.trim()).filter(Boolean);
}

export type ParsedTikTokToken =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      refreshExpiresIn: number | null;
      openId: string;
      scopes: string[];
      grantedUpload: boolean;
    }
  | {
      ok: false;
      reason:
        | "invalid_token"
        | "missing_scope"
        | "publish_scope"
        | "unexpected_scope"
        | "missing_refresh"
        | "missing_expiry"
        | "invalid_account";
    };

export function parseTikTokToken(body: unknown, consent: TikTokConsent = "identity"): ParsedTikTokToken {
  if (!body || typeof body !== "object") return { ok: false, reason: "invalid_token" };
  const record = body as {
    error?: unknown;
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
    refresh_expires_in?: unknown;
    open_id?: unknown;
    scope?: unknown;
  };
  if (text(record.error)) return { ok: false, reason: "invalid_token" };
  const accessToken = text(record.access_token);
  const refreshToken = text(record.refresh_token);
  const openId = text(record.open_id);
  const scopes = tikTokScopes(text(record.scope));
  if (!accessToken || !openId) return { ok: false, reason: "invalid_token" };
  if (!isTikTokOpenId(openId)) return { ok: false, reason: "invalid_account" };
  const accepted = acceptTikTokScopes(scopes, consent);
  if (!accepted.ok) return accepted;
  if (!refreshToken) return { ok: false, reason: "missing_refresh" };
  if (typeof record.expires_in !== "number" || !Number.isFinite(record.expires_in) || record.expires_in <= 0) {
    return { ok: false, reason: "missing_expiry" };
  }
  const refreshExpiresIn = typeof record.refresh_expires_in === "number"
    && Number.isFinite(record.refresh_expires_in)
    && record.refresh_expires_in > 0
    ? record.refresh_expires_in
    : null;
  return {
    ok: true,
    accessToken,
    refreshToken,
    expiresIn: record.expires_in,
    refreshExpiresIn,
    openId,
    scopes: accepted.scopes,
    grantedUpload: accepted.grantedUpload,
  };
}

export function acceptTikTokScopes(
  scopes: readonly string[],
  consent: TikTokConsent,
): { ok: true; scopes: string[]; grantedUpload: boolean } | {
  ok: false;
  reason: "missing_scope" | "publish_scope" | "unexpected_scope";
} {
  const unique = [...new Set(scopes)];
  if (!unique.includes(TIKTOK_SCOPE)) return { ok: false, reason: "missing_scope" };
  if (unique.includes(TIKTOK_PUBLISH_SCOPE)) return { ok: false, reason: "publish_scope" };
  const extras = unique.filter((scope) => scope !== TIKTOK_SCOPE && scope !== TIKTOK_UPLOAD_SCOPE);
  if (extras.length > 0) return { ok: false, reason: "unexpected_scope" };
  if (consent === "upload" && !unique.includes(TIKTOK_UPLOAD_SCOPE)) {
    return { ok: false, reason: "missing_scope" };
  }
  const grantedUpload = unique.includes(TIKTOK_UPLOAD_SCOPE);
  return {
    ok: true,
    scopes: grantedUpload ? [TIKTOK_SCOPE, TIKTOK_UPLOAD_SCOPE] : [TIKTOK_SCOPE],
    grantedUpload,
  };
}

export function safeTikTokDisplayName(value: unknown): string {
  const raw = text(value) ?? "";
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 120);
  return cleaned.length > 0 ? cleaned : "Cont TikTok";
}

export function parseTikTokUser(body: unknown, openId: string):
  | { ok: true; openId: string; displayName: string }
  | { ok: false; reason: "invalid_account" | "account_mismatch" } {
  if (!isTikTokOpenId(openId)) return { ok: false, reason: "invalid_account" };
  if (!body || typeof body !== "object") return { ok: false, reason: "invalid_account" };
  const record = body as { data?: unknown; error?: unknown };
  const error = record.error && typeof record.error === "object"
    ? text((record.error as { code?: unknown }).code)
    : null;
  if (error && error !== "ok") return { ok: false, reason: "invalid_account" };
  const data = record.data && typeof record.data === "object"
    ? (record.data as { user?: unknown }).user
    : null;
  if (!data || typeof data !== "object") return { ok: false, reason: "invalid_account" };
  const returned = text((data as { open_id?: unknown }).open_id);
  if (!returned || !isTikTokOpenId(returned)) return { ok: false, reason: "invalid_account" };
  if (returned !== openId) return { ok: false, reason: "account_mismatch" };
  return {
    ok: true,
    openId: returned,
    displayName: safeTikTokDisplayName((data as { display_name?: unknown }).display_name),
  };
}

export function encodeTikTokToken(input: {
  accessToken: string;
  refreshToken: string;
  obtainedAt: string;
  refreshExpiresIn: number | null;
}): string {
  return JSON.stringify({
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    obtained_at: input.obtainedAt,
    refresh_expires_in: input.refreshExpiresIn,
  });
}

export function readTikTokToken(serialized: string): { accessToken: string; refreshToken: string } | null {
  try {
    const parsed = JSON.parse(serialized) as { access_token?: unknown; refresh_token?: unknown };
    const accessToken = text(parsed.access_token);
    const refreshToken = text(parsed.refresh_token);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

export function publicTikTokConnection(input: {
  displayName: string | null;
  status: string;
  scopes: string[];
}): { displayName: string | null; status: string; scopes: string[] } {
  return {
    displayName: input.displayName,
    status: input.status,
    scopes: input.scopes.filter((scope) => scope === TIKTOK_SCOPE || scope === TIKTOK_UPLOAD_SCOPE),
  };
}

export function redactTikTokErrorMessage(value: string | null, secret = ""): string | null {
  if (!value) return null;
  let cleaned = value;
  if (secret) cleaned = cleaned.split(secret).join("[redacted]");
  cleaned = cleaned
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/\S+/g, "[redacted-url]");
  return cleaned.slice(0, 300);
}
