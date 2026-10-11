import { createHmac } from "node:crypto";
import { META_GRAPH_VERSION, type MetaReadyConfig } from "@/lib/integrations/meta/config";
import {
  expiryFromSeconds,
  missingRequiredScopes,
  parseAccessTokenBody,
  parseDebugToken,
  parseMetaPages,
  type MetaPage,
} from "@/lib/integrations/meta/flow";

const GRAPH_ORIGIN = "https://graph.facebook.com";
const CALL_TIMEOUT_MS = 2000;

export function appSecretProof(accessToken: string, appSecret: string): string {
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

export type MetaHttp = (
  url: string,
  init: { method?: "GET" | "DELETE"; headers?: Record<string, string>; timeoutMs: number },
) => Promise<{ ok: boolean; status: number; body: unknown } | { ok: false; timeout: true }>;

export function createMetaHttp(fetchImpl: typeof fetch = fetch): MetaHttp {
  return async (url, init) => {
    try {
      const response = await fetchImpl(url, {
        method: init.method ?? "GET",
        headers: init.headers,
        signal: AbortSignal.timeout(init.timeoutMs),
        cache: "no-store",
      });
      const text = await response.text();
      let body: unknown = null;
      if (text) {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          body = null;
        }
      }
      return { ok: response.ok, status: response.status, body };
    } catch {
      return { ok: false, timeout: true };
    }
  };
}

function graphUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`${GRAPH_ORIGIN}/${META_GRAPH_VERSION}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export type ExchangedMetaToken =
  | {
      ok: true;
      accessToken: string;
      expiresAt: string | null;
      scopes: string[];
      userId: string;
      displayName: string | null;
      permissionsOk: boolean;
    }
  | { ok: false; reason: "timeout" | "exchange_failed" | "invalid_token" };

export async function exchangeMetaAuthorization(input: {
  config: MetaReadyConfig;
  code: string;
  codeVerifier: string;
  now?: Date;
  http?: MetaHttp;
}): Promise<ExchangedMetaToken> {
  const http = input.http ?? createMetaHttp();
  const now = input.now ?? new Date();
  const exchange = await http(
    graphUrl("oauth/access_token", {
      client_id: input.config.appId,
      redirect_uri: input.config.redirectUri,
      client_secret: input.config.appSecret,
      code: input.code,
      code_verifier: input.codeVerifier,
    }),
    { timeoutMs: CALL_TIMEOUT_MS },
  );
  if ("timeout" in exchange) return { ok: false, reason: "timeout" };
  const shortLived = parseAccessTokenBody(exchange.body);
  if (!exchange.ok || !shortLived.ok) return { ok: false, reason: "exchange_failed" };

  const extended = await http(
    graphUrl("oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: input.config.appId,
      client_secret: input.config.appSecret,
      fb_exchange_token: shortLived.accessToken,
    }),
    { timeoutMs: CALL_TIMEOUT_MS },
  );
  if ("timeout" in extended) return { ok: false, reason: "timeout" };
  const longLived = extended.ok ? parseAccessTokenBody(extended.body) : { ok: false as const };
  const accessToken = longLived.ok ? longLived.accessToken : shortLived.accessToken;
  const expiresAt = longLived.ok
    ? expiryFromSeconds(longLived.expiresIn, now)
    : expiryFromSeconds(shortLived.expiresIn, now);

  const proof = appSecretProof(accessToken, input.config.appSecret);
  const debug = await http(
    graphUrl("debug_token", {
      input_token: accessToken,
      access_token: `${input.config.appId}|${input.config.appSecret}`,
    }),
    { timeoutMs: CALL_TIMEOUT_MS },
  );
  if ("timeout" in debug) return { ok: false, reason: "timeout" };
  const inspected = parseDebugToken(debug.body, input.config.appId);
  if (!debug.ok || !inspected.ok) return { ok: false, reason: "invalid_token" };

  const profile = await http(
    graphUrl("me", { fields: "id,name", appsecret_proof: proof }),
    {
      timeoutMs: CALL_TIMEOUT_MS,
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  let displayName: string | null = null;
  if (!("timeout" in profile) && profile.ok && profile.body && typeof profile.body === "object") {
    const name = (profile.body as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) displayName = name.trim().slice(0, 200);
  }

  return {
    ok: true,
    accessToken,
    expiresAt: expiresAt ?? inspected.expiresAt,
    scopes: inspected.scopes,
    userId: inspected.userId,
    displayName,
    permissionsOk: missingRequiredScopes(inspected.scopes).length === 0,
  };
}

export async function fetchMetaPages(input: {
  config: MetaReadyConfig;
  accessToken: string;
  http?: MetaHttp;
}): Promise<{ ok: true; pages: MetaPage[] } | { ok: false; reason: "timeout" | "graph_error" }> {
  const http = input.http ?? createMetaHttp();
  const proof = appSecretProof(input.accessToken, input.config.appSecret);
  const response = await http(
    graphUrl("me/accounts", {
      fields: "id,name,tasks,instagram_business_account{id,username}",
      appsecret_proof: proof,
      limit: "50",
    }),
    {
      timeoutMs: 6000,
      headers: { Authorization: `Bearer ${input.accessToken}` },
    },
  );
  if ("timeout" in response) return { ok: false, reason: "timeout" };
  if (!response.ok) return { ok: false, reason: "graph_error" };
  return { ok: true, pages: parseMetaPages(response.body) };
}

export async function revokeMetaPermissions(input: {
  config: MetaReadyConfig;
  accessToken: string;
  http?: MetaHttp;
}): Promise<"confirmed" | "failed" | "timeout"> {
  const http = input.http ?? createMetaHttp();
  const proof = appSecretProof(input.accessToken, input.config.appSecret);
  const response = await http(
    graphUrl("me/permissions", { appsecret_proof: proof }),
    {
      method: "DELETE",
      timeoutMs: CALL_TIMEOUT_MS,
      headers: { Authorization: `Bearer ${input.accessToken}` },
    },
  );
  if ("timeout" in response) return "timeout";
  if (!response.ok || !response.body || typeof response.body !== "object") return "failed";
  return (response.body as { success?: unknown }).success === true ? "confirmed" : "failed";
}
